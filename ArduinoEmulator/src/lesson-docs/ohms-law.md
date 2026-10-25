To build circuits that work, and that don't burn out, you need three ideas: voltage, current and resistance. They are tied together by one short equation.

## Water in a pipe

Electricity behaves a lot like water flowing through pipes:

- **Voltage** is the *pressure* pushing the water. It is measured in **volts (V)**. The Uno's 5V pin is like a tank 5 units high.
- **Current** is the *flow*: how much water passes a point each second. It is measured in **amperes (A)**, usually milliamps (mA) on an Arduino. 1000 mA = 1 A.
- **Resistance** is how *narrow* the pipe is: how hard it is for water to get through. It is measured in **ohms (Ω)**.

More pressure pushes more water. A narrower pipe lets less through. That is the whole relationship.

A **resistor** is a small part whose only job is to add resistance: a deliberately narrow bit of pipe you can put into a circuit to hold the current back.

## Ohm's law

```text
V = I × R

voltage (volts) = current (amps) × resistance (ohms)
```

Electronics uses **I** as the letter for current (from the French *intensité*) and **R** for resistance. Rearranged, the equation answers whichever question you have:

| You know | You want | Use |
|---|---|---|
| Current and resistance | Voltage | V = I × R |
| Voltage and resistance | Current | I = V ÷ R |
| Voltage and current | Resistance | R = V ÷ I |

### Worked example

A 250 Ω resistor is connected between the 5V pin and GND. How much current flows?

```text
I = V ÷ R = 5 V ÷ 250 Ω = 0.02 A = 20 mA
```

Swap in a 1000 Ω resistor and the current drops to 5 mA. Swap in a 10 Ω resistor and it jumps to 500 mA, far more than an Arduino pin can safely supply.

> [!TIP]
> Keep units straight: volts ÷ ohms gives **amps**. Multiply by 1000 to get milliamps. Resistors are often labelled with k for thousands: 1 kΩ = 1000 Ω, 10 kΩ = 10,000 Ω.

## Power, and why parts get hot

The energy a part turns into heat each second is its **power**, measured in **watts (W)**:

```text
P = V × I
```

That 10 Ω resistor across 5 V would carry 0.5 A and turn 2.5 W into heat. A typical small resistor is **rated** for 0.25 W (designed to safely handle up to that much), so it would quickly get very hot. Ohm's law lets you catch problems like this before you build them.

## Short circuits

A wire has almost no resistance. Connect the 5V pin straight to GND (0 V) with a wire and R is nearly 0, so I = V ÷ R becomes enormous. That is a **short circuit**, and it can damage the board. Every path from 5V (or a pin) to GND needs something with resistance in it.

## Key ideas

- Voltage is the push (V), current is the flow (A), resistance limits the flow (Ω).
- Ohm's law: V = I × R.
- Power turned into heat is P = V × I.
- A path from 5V to GND with no resistance is a short circuit.

```quiz
Q: A 500 Ω resistor is connected across 5 V. What current flows?
- [ ] 100 mA
- [x] 10 mA
- [ ] 2500 mA
- [ ] 1 mA
= I = V ÷ R = 5 ÷ 500 = 0.01 A, which is 10 mA.

Q: You want exactly 5 mA to flow from a 5 V supply. What resistance do you need?
- [ ] 25 Ω
- [ ] 100 Ω
- [x] 1000 Ω
- [ ] 5000 Ω
= R = V ÷ I = 5 V ÷ 0.005 A = 1000 Ω (1 kΩ).

Q: Why is connecting 5V directly to GND with a wire a bad idea?
- [ ] It makes no difference
- [ ] The voltage becomes 10 V
- [x] With almost no resistance, a huge current flows
- [ ] Current stops flowing completely
= With R close to zero, I = V ÷ R becomes very large. That is a short circuit, and it can overheat wires and damage the board.
```
