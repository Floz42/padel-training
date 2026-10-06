/**
 * Decodes a generated FIT workout and prints its steps — sanity check before
 * copying to the watch. Usage: node check-fit.mjs dist/PADEL_A45_S7.FIT
 */
import { readFileSync } from 'node:fs'
import { Decoder, Stream } from '@garmin/fitsdk'

const file = process.argv[2]
const decoder = new Decoder(Stream.fromBuffer(readFileSync(file)))
console.log('FIT valide :', decoder.isFIT(), '| intégrité :', decoder.checkIntegrity())

const { messages, errors } = decoder.read()
if (errors.length) console.log('Erreurs :', errors)

const w = messages.workoutMesgs[0]
console.log(`\n${w.wktName} — ${w.sport}/${w.subSport} — ${w.numValidSteps} étapes\n`)
for (const s of messages.workoutStepMesgs) {
  const what =
    s.durationType === 'repeatUntilStepsCmplt'
      ? `   ↺ répéter depuis l'étape ${s.durationStep} × ${s.repeatSteps}`
      : `${String(s.messageIndex).padStart(2)} ${s.intensity.padEnd(7)} ${s.wktStepName} — ${
          s.durationType === 'reps' ? `${s.durationReps} reps` : `${s.durationTime} s`
        }${s.exerciseCategory !== undefined ? ` [${s.exerciseCategory}/${s.exerciseName}]` : ''}`
  console.log(what)
}
console.log(`\n${messages.exerciseTitleMesgs?.length ?? 0} titres d'exercice`)
