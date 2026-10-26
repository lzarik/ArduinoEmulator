// The splash site's Mission, Features and How It Works notebook pages.

export function MissionPage() {
  return (
    <div className="notebook-text mission">
      <p>
        Every phone, car and microwave runs on code someone wrote for a tiny chip. Most people never get to see how
        that works, because learning it usually means buying parts, installing tools and wading through manuals
        written for experts.
      </p>
      <p>
        Ohmster is here to change that. We want anyone who's curious, with no experience and no budget, to be able to
        blink their first LED in a few minutes, and then keep pulling the thread: from wires and resistors, to code,
        all the way down to the exact instructions the chip runs.
      </p>
      <p className="mission-line">Free, in your browser, with nothing hidden.</p>
    </div>
  )
}

const FEATURES = [
  {
    title: 'A real compiler',
    text: 'Your code is built with the same compiler the official Arduino app uses, so what runs here is exactly what would run on a real board.',
  },
  {
    title: 'A real chip, emulated',
    text: "Ohmster runs the actual machine code one instruction at a time, just like the Arduino's ATmega328P chip, timers and all.",
  },
  {
    title: 'See inside while it runs',
    text: 'Pause at any moment and step one instruction at a time. Watch the registers, memory and pins change, with each instruction linked to the line of code it came from.',
  },
  {
    title: 'A breadboard that reacts',
    text: 'Place LEDs, resistors and buttons, click to wire them up, and watch them respond to your program. Forget a resistor and your LED catches fire, safely.',
  },
  {
    title: 'A course from zero',
    text: 'Lessons take you from blinking your first LED to reading the chip’s instruction set, each with a quick quiz. Every lesson you finish lights an LED on your course map.',
  },
  {
    title: 'Nothing to install',
    text: 'It all runs in your browser, with no parts to buy and no software to set up. Your projects are saved right there with it.',
  },
]

export function FeaturesPage() {
  return (
    <ul className="features-grid">
      {FEATURES.map((f, i) => (
        <li key={f.title} className="feature-card">
          <span className="feature-number">{String(i + 1).padStart(2, '0')}</span>
          <h3>{f.title}</h3>
          <p>{f.text}</p>
        </li>
      ))}
    </ul>
  )
}

const STEPS = [
  {
    title: 'Write your code',
    text: 'Open a project and write your sketch in the Code tab, or press Open in editor on any lesson’s example to start from there.',
  },
  {
    title: 'Build the circuit',
    text: 'Switch to the Design tab, place parts on the breadboard, and click two holes to connect them with a wire.',
  },
  {
    title: 'Press Run',
    text: 'Ohmster compiles your sketch and loads it into the emulated chip. It runs in real time, and the parts on your breadboard light up and react.',
  },
  {
    title: 'Look inside',
    text: 'Stop whenever you like and press Step to run one instruction at a time. The debugger shows exactly what the chip is doing, and which line of your code it’s on.',
  },
  {
    title: 'Learn as you go',
    text: 'The Learn tab walks you through it all, one lesson at a time. Finish a lesson’s quiz to light its LED.',
  },
]

export function HowItWorksPage() {
  return (
    <div className="how">
      <div className="how-video" aria-label="Tutorial video coming soon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5 L19 12 L8 19 Z" />
        </svg>
        <span>Tutorial video coming soon</span>
      </div>
      <ol className="how-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="how-step">
            <span className="how-step-number">{i + 1}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
