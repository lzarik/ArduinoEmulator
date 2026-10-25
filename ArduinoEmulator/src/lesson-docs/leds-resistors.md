LEDs are the first part almost everyone wires up, and the first part almost everyone burns out. Ohm's law explains both why they need a resistor and how to choose one.

## What an LED is

LED stands for **light-emitting diode**. A **diode** lets current flow in only one direction, like a one-way valve. An LED is a diode that glows when current flows through it.

Because it is one-way, an LED has to be connected the right way round:

- The **anode** (+) is the longer leg. It connects toward the positive side, such as an Arduino pin.
- The **cathode** (−) is the shorter leg, next to the flat edge of the plastic. It connects toward GND.

Wire it backwards and nothing breaks; it just doesn't light.

## Why an LED needs a resistor

The voltage **across** a part means the difference in voltage between its two legs. An LED needs a certain voltage across it before it turns on, called its **forward voltage**. It is about 2 V for red and yellow LEDs and about 3 V for green, blue and white.

Once that voltage is reached, an LED has almost no resistance of its own. Whatever voltage is left over would push an enormous current through it, and a typical LED is only good for about 20 mA. So a **resistor** goes **in series** with the LED (one after the other, in a single path; more on that below) to soak up the leftover voltage and limit the current.

::diagram led-circuit

## Choosing the resistor

The resistor gets whatever voltage the LED doesn't use. With a 5 V pin and a red LED:

```text
voltage across resistor = 5 V − 2 V = 3 V
```

Pick a safe current, say 15 mA, and use Ohm's law:

```text
R = V ÷ I = 3 V ÷ 0.015 A = 200 Ω
```

Resistors come in standard values, so round **up** to the next one: **220 Ω**. Rounding up means slightly less current, which is always the safe direction. Anywhere from 220 Ω to 1 kΩ works well for an LED on an Arduino; higher values just make it dimmer.

> [!WARNING]
> An Arduino pin can supply at most about 40 mA before it is damaged, and 20 mA is the recommended limit. An LED with no resistor will try to **draw** (pull) far more. In Ohmster's Design tab, an LED wired with no resistor in its path catches fire, so you can see the mistake without losing a real part.

## Series means one path

"In series" means the current has only one path: out of the pin, through the resistor, through the LED, into GND. The same current flows through every part, so the order doesn't matter. The resistor can go before or after the LED.

## Try it

The starter circuit in a new Ohmster project already has an LED and a 220 Ω resistor wired to pin 13. Open the Design tab and follow the path: pin 13 → LED → resistor → GND rail (the long strip along the breadboard's edge that's connected to GND; the next lesson explains rails). Then try deleting the resistor and adding a wire in its place, and run Blink.

## Key ideas

- An LED only lets current through one way: anode (long leg) to the + side, cathode (short leg, flat edge) to GND.
- Once on, an LED barely resists current, so it needs a resistor in series.
- R = (supply voltage − LED forward voltage) ÷ current. 220 Ω is a good default at 5 V.

```quiz
Q: Which leg of an LED connects toward GND?
- [ ] The anode, the longer leg
- [x] The cathode, the shorter leg next to the flat edge
- [ ] Either one, LEDs work both ways
- [ ] Neither, LEDs don't use GND
= Current flows from anode to cathode, so the cathode (short leg, flat edge) goes toward GND.

Q: A blue LED has a forward voltage of 3 V. On a 5 V pin, what resistor gives about 10 mA?
- [ ] 50 Ω
- [x] 200 Ω
- [ ] 500 Ω
- [ ] 3000 Ω
= The resistor gets 5 − 3 = 2 V. R = 2 V ÷ 0.010 A = 200 Ω, so you would use the next standard value up, 220 Ω.

Q: Why should you round a calculated resistor value up rather than down?
- [x] A bigger resistor means a little less current, which is the safe side
- [ ] Bigger resistors are cheaper
- [ ] Rounding down makes the LED turn off
- [ ] It doesn't matter at all
= More resistance means less current. A slightly dimmer LED is fine; a slightly overloaded one wears out.
```
