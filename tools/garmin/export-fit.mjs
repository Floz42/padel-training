/**
 * Exports padel-training sessions as Garmin FIT workout files.
 *
 * Usage: node export-fit.mjs [session=A|B] [duration=30|45|60] [week=1..9]
 *   node export-fit.mjs A 45 7   -> dist/PADEL_A45_S7.FIT
 *   node export-fit.mjs all 7    -> A/B x 30/45/60 for week 7 (the current block)
 *   node export-fit.mjs all      -> every session x duration x week block
 *
 * The program is read straight from ../../index.html (const PROGRAM), so the app
 * stays the single source of truth: edit the app, re-run this script, copy the
 * files to GARMIN/NewFiles on the watch.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Encoder, Profile } from '@garmin/fitsdk'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = join(HERE, '..', '..', 'index.html')
const OUT = join(HERE, 'dist')

/* Closest Garmin catalogue exercise for each app exercise: [category, exerciseName id].
   The watch displays our own name (wktStepName); the category drives rep counting
   and the muscle map in Garmin Connect. Classic categories only — the newer
   "bandedExercises" one may be unknown to entry-level watches. */
const C = Profile.types.exerciseCategory
const cat = (name) => Number(Object.keys(C).find((k) => C[k] === name))
const GARMIN = {
  planche: ['plank', 43], // plank
  'warm-arm-circles': ['warmUp', 5], // armCircles
  chop: ['chop', 2], // cableWoodchop
  'dev-couche': ['pushUp', 0], // chestPressWithBand
  tirage: ['row', 1], // cableRowStanding
  'tirage-vert': ['pullUp', 11], // kneelingLatPulldown
  ecarte: ['flye', 0], // cableCrossover
  'dev-mil': ['shoulderPress', 15], // overheadDumbbellPress
  'planche-lat': ['plank', 66], // sidePlank
  pullover: ['pullUp', 19], // standingCablePullover
  'face-pull': ['row', 39], // bandedFacePulls
  curl: ['curl', 8], // cableBicepsCurl
  triceps: ['tricepsExtension', 39], // tricepsPressdown
  'curl-pronation': ['curl', 31], // reverseGripBarbellBicepsCurl
  'wrist-ext': ['curl', 17], // dumbbellReverseWristCurl
  'warm-squat': ['squat', 61], // squat
  'squat-jump': ['plyo', 3], // bodyWeightJumpSquat
  skater: ['plyo', 17], // lateralLeapAndHop
  depart: ['run', 3], // sprint
  'split-jump': ['plyo', 0], // alternatingJumpLunge
  twist: ['chop', 19], // standingRotationalChop
  'squat-elast': ['squat', 63], // squatsWithBand
  mollets: ['calfRaise', 18], // standingCalfRaise
  sdt: ['deadlift', 23], // romanianDeadlift
  pallof: ['core', 6], // cableCorePress (= Pallof press)
  bulgare: ['lunge', 18], // dumbbellBulgarianSplitSquat
}

/**
 * Evaluates the PROGRAM object literal from the app source, with each session reordered
 * the way the app renders it: bloc by bloc following BLOC_ORDER, source order within a bloc.
 */
const loadProgram = () => {
  const html = readFileSync(APP, 'utf8')
  const m = html.match(/const PROGRAM = (\{[\s\S]*?\n\});/)
  if (!m) throw new Error('PROGRAM introuvable dans index.html')
  const o = html.match(/const BLOC_ORDER = (\{[\s\S]*?\});/)
  if (!o) throw new Error('BLOC_ORDER introuvable dans index.html')
  const program = new Function(`return ${m[1]}`)()
  const order = new Function(`return ${o[1]}`)()
  for (const s of Object.keys(program))
    program[s] = order[s].flatMap((bloc) => program[s].filter((e) => e.bloc === bloc))
  return program
}

/* Same rules as effSets() / WEEK_NOTES in the app. */
const effSets = (base, week) => {
  if (!base) return 0
  if (week <= 2) return Math.max(2, base - 1)
  if (week >= 9) return Math.max(1, Math.round(base / 2))
  return base
}

/**
 * Turns the app's free-text prescription into a watch step duration.
 * "8–10" -> 10 reps (top of the range, the progression target), "30 s" -> 30 s,
 * "8 min" -> 480 s, "10 avant / 10 arrière" -> 20 reps, "/ côté" kept as a label.
 */
const parsePrescription = (reps, week, id) => {
  const perSide = /\/\s*(côté|bras|jambe)/.test(reps)
  const min = reps.match(/(\d+)\s*min/)
  if (min) return { kind: 'time', value: Number(min[1]) * 60, perSide }
  const sec = reps.match(/(\d+)\s*s\b/)
  if (sec) return { kind: 'time', value: Number(sec[1]), perSide }

  const numbers = [...reps.matchAll(/\d+/g)].map((n) => Number(n[0]))
  let value = /avant .* arrière/.test(reps) ? numbers.reduce((a, b) => a + b, 0) : Math.max(...numbers)
  // Weeks 5-6: +2 reps on squat jumps and skaters (not on split jumps)
  if (week >= 5 && week <= 6 && (id === 'squat-jump' || id === 'skater')) value += 2
  return { kind: 'reps', value, perSide }
}

/* The encoder ignores sub-field names (durationTime, durationReps, repeatSteps...):
   raw fields are written instead, and time durations are stored in milliseconds. */
const ms = (seconds) => seconds * 1000

/**
 * Truncates a string to a UTF-8 byte budget (FIT string fields max out at 255 bytes,
 * and accented characters take 2-3 bytes), without cutting a character in half.
 */
const fitString = (text, maxBytes) => {
  let out = ''
  for (const ch of text) {
    if (Buffer.byteLength(out + ch) > maxBytes - 1) return out.trimEnd() + '…'
    out += ch
  }
  return out
}

const weekHint = (id, week) => {
  if (week >= 7 && week <= 8 && ['dev-couche', 'tirage'].includes(id)) return 'Tempo : 3 s à la descente.'
  if (week <= 2) return 'Semaines 1-2 : élastique léger.'
  return ''
}

/** Builds the workout steps (exercise, rest, repeat) for one session. */
const buildSteps = (program, session, duration, week) => {
  const steps = []
  const titles = new Map()

  for (const e of program[session].filter((x) => x.tier <= duration)) {
    const base = e.sets[duration] || e.sets[e.tier]
    const sets = e.warm ? base : effSets(base, week)
    if (!sets) continue

    const p = parsePrescription(e.reps, week, e.id)
    // A single-rep step reads as "1 reps" on the watch: spell out the set count and rest instead
    const single = p.kind === 'reps' && p.value === 1 && sets > 1
    const suffix = single ? ` (×${sets}, ${e.rest} s récup)` : p.perSide ? ' (par côté)' : ''
    const name = fitString(`${e.name}${suffix}`, 60)
    const notes = fitString([e.detail, weekHint(e.id, week), e.note].filter(Boolean).join(' · '), 250)
    const garmin = GARMIN[e.id]

    const exercise = {
      wktStepName: name,
      intensity: e.warm ? 'warmup' : 'active',
      targetType: 'open',
      notes,
      ...(p.kind === 'reps'
        ? { durationType: 'reps', durationValue: p.value }
        : { durationType: 'time', durationValue: ms(p.value * (p.perSide ? 2 : 1)) }),
      ...(garmin ? { exerciseCategory: cat(garmin[0]), exerciseName: garmin[1] } : {}),
    }
    if (garmin) titles.set(`${garmin[0]}|${garmin[1]}`, { garmin, name })

    const first = steps.length
    steps.push(exercise)
    if (e.rest) {
      steps.push({ wktStepName: 'Repos', intensity: 'rest', durationType: 'time', durationValue: ms(e.rest), targetType: 'open' })
    }
    if (sets > 1) {
      // Repeat step: durationValue = index of the step to loop back to, targetValue = repeat count
      steps.push({ durationType: 'repeatUntilStepsCmplt', durationValue: first, targetType: 'open', targetValue: sets })
    }
  }

  return { steps: steps.map((s, i) => ({ ...s, messageIndex: i })), titles: [...titles.values()] }
}

const writeWorkout = (program, session, duration, week) => {
  const { steps, titles } = buildSteps(program, session, duration, week)
  const wktName = `Padel ${session} ${duration}' S${week}`
  const encoder = new Encoder()

  /* The watch identifies a file by its FILE_ID (manufacturer + product + serial + timeCreated):
     files sharing one are treated as the same workout and overwrite each other. "all" writes
     six files within the same second, so the serial must differ per session/format/week. */
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'workout',
    manufacturer: 'development',
    product: 0,
    timeCreated: new Date(),
    serialNumber: (session === 'A' ? 1 : 2) * 10000 + duration * 100 + week,
  })
  encoder.onMesg(Profile.MesgNum.WORKOUT, {
    wktName,
    sport: 'training',
    subSport: 'strengthTraining',
    numValidSteps: steps.length,
  })
  steps.forEach((s) => encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, s))
  titles.forEach(({ garmin, name }, i) =>
    encoder.onMesg(Profile.MesgNum.EXERCISE_TITLE, {
      messageIndex: i,
      exerciseCategory: cat(garmin[0]),
      exerciseName: garmin[1],
      wktStepName: name,
    })
  )

  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `PADEL_${session}${duration}_S${week}.FIT`)
  writeFileSync(file, encoder.close())
  console.log(`${file}  (${steps.length} étapes)`)
}

const program = loadProgram()
const [session = 'A', duration = '45', week = '3'] = process.argv.slice(2)

if (session === 'all') {
  // "all 7" -> A/B x 30/45/60 for that week only; "all" -> also every week block (1, 3, 5, 7, 9)
  const weeks = process.argv[3] ? [Number(process.argv[3])] : [1, 3, 5, 7, 9]
  for (const s of Object.keys(program))
    for (const d of [30, 45, 60]) for (const w of weeks) writeWorkout(program, s, d, w)
} else {
  writeWorkout(program, session, Number(duration), Number(week))
}
