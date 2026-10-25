Before writing code, it helps to know your way around the board. Open the **Design** tab alongside this lesson and find each part as you read.

## The headers

The black strips of sockets along the top and bottom edges are **headers**. Each socket connects to one pin of the microcontroller (or to power), and you plug wires into them.

### Digital pins 0 to 13

Along the top edge are the **digital pins**, numbered 0 to 13. **Digital** means there are only two possible values, like a light switch: on or off. A digital pin is either **HIGH** (5 volts, "on") or **LOW** (0 volts, "off"), nothing in between. Your program decides which. (Volts measure electrical push; *Voltage, Current and Resistance* explains them.)

- Pins marked with a **~** (3, 5, 6, 9, 10 and 11) can also produce **PWM** (pulse-width modulation): switching the pin on and off hundreds of times a second. An LED flickering that fast looks steady but dimmer, so PWM is how you dim lights and control motor speed.
- Pins **0 and 1** are labelled **RX** (receive) and **TX** (transmit). They are shared with the board's **serial** connection, the channel it uses to send text back and forth with your computer over USB, so it is best to leave them free.

### Analog inputs A0 to A5

Along the bottom right are the **analog inputs**. **Analog** is the opposite of digital: a value that can be anything in a range, like a dimmer instead of a switch. Besides reading HIGH and LOW, these can measure a voltage anywhere between 0 and 5 volts, which is how you read things like a light sensor or a knob. They also work as ordinary digital pins.

### Power

Along the bottom left is the **power header**:

| Socket | What it is |
|---|---|
| 5V | A steady 5 volts, for powering your circuits |
| 3.3V | A steady 3.3 volts, for parts that need less |
| GND | **Ground**: 0 volts. A **circuit** is a complete loop that electricity flows around, and every circuit must connect back to ground to finish the loop. |
| VIN | The raw voltage from the **barrel jack** (the round power socket), if you use one |
| RESET | Connecting this to 0 V (LOW) restarts the program |

> [!TIP]
> **GND** appears three times on the Uno (twice on the power header and once next to pin 13). They are all the same connection, so use whichever is closest.

## Everything else

- **USB connector** (the silver box on the left): powers the board and is how programs get **uploaded** (copied onto it).
- **Barrel jack** (the black block below it): lets you power the board from a 7 to 12 volt wall adapter instead of USB.
- **Reset button**: restarts your program from the beginning. Try clicking it on the board in the Design tab.
- **The "L" LED**: a tiny LED wired to **pin 13** on the board itself. You can blink it without wiring anything.
- **The "ON" LED**: lights whenever the board has power.
- **TX and RX LEDs**: flicker when data goes over USB.
- **The ATmega328P**: the long chip near the bottom right. This is the computer. Everything else serves it.

## Pins are numbers in your code

When you write code, you refer to digital pins by number and analog pins by name. `13` means digital pin 13 and `A0` means analog pin 0. In the next lesson you will use pin 13 to blink the L LED.

## Key ideas

- Digital pins 0 to 13 are HIGH (5 V) or LOW (0 V). Pins with ~ can do PWM.
- Analog pins A0 to A5 can measure voltages between 0 and 5 V.
- 5V, 3.3V and GND power your circuits. Every circuit returns to GND.
- The built-in L LED is connected to pin 13.

```quiz
Q: Which pin is the built-in "L" LED connected to?
- [ ] Pin 0
- [ ] Pin 1
- [x] Pin 13
- [ ] A0
= The L LED is wired to digital pin 13, so a program that drives pin 13 blinks it without any extra parts.

Q: What does the ~ symbol next to some digital pins mean?
- [ ] The pin is broken
- [ ] The pin can measure analog voltages
- [x] The pin can produce PWM
- [ ] The pin is connected to ground
= Pins 3, 5, 6, 9, 10 and 11 can generate PWM, a rapid on-off signal used for dimming and speed control.

Q: Why should every circuit connect back to a GND socket?
- [x] Current needs a complete loop back to 0 volts to flow at all
- [ ] GND makes the board run faster
- [ ] GND stores the program
- [ ] It doesn't matter, GND is optional
= Electricity only flows around a complete loop. GND is the 0 volt end of that loop, so without it no current flows.
```
