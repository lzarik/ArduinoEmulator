So far the Arduino has only been talking. Now it listens. A push button is the simplest input there is, but reading one reliably takes one extra idea: the pull-up resistor.

## Reading a pin

`digitalRead(pin)` looks at the voltage on a pin and **returns** (gives back as its answer) **HIGH** if it is near 5 V or **LOW** if it is near 0 V. To use it, the pin has to be set up as an input, which is the default.

## The floating pin problem

You might try wiring a button between a pin and 5V: pressed, the pin connects to 5 V and reads HIGH. But when the button is *not* pressed, the pin isn't connected to anything. It is **floating**, and a floating input picks up electrical **noise** (tiny random voltages from nearby wires and devices) like an antenna. It reads HIGH, then LOW, then HIGH, at random.

An input needs a definite voltage at all times, pressed or not.

## Pull-up resistors

The fix is a **pull-up resistor**: a resistor with a lot of resistance (such as 10 kΩ, ten thousand ohms) from the pin to 5V. With the button wired from the pin to **GND**:

- **Not pressed:** the resistor gently pulls the pin up to 5 V. It reads **HIGH**.
- **Pressed:** the button connects the pin straight to GND. That wins over the weak resistor, so the pin reads **LOW**.

::diagram button-pullup

The resistor's high value keeps the current tiny when the button is pressed: 5 V ÷ 10 kΩ is only 0.5 mA.

## The built-in pull-up

The ATmega328P has a pull-up resistor (about 20 to 50 kΩ) built into every pin. Turn it on with `INPUT_PULLUP`, and you only need the button itself, wired from the pin to GND:

```cpp try
const int buttonPin = 2;
const int ledPin = 13;

void setup()
{
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop()
{
  // With a pull-up, pressed reads LOW
  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
```

A few new pieces of code here:

- `const int buttonPin = 2;` gives pin 2 a name, so the code can say `buttonPin` instead of a bare number. `const` means the value never changes.
- `==` asks "is this equal to that?" (a single `=` means something else, as you'll see in *Conditions and Loops*).
- `else` holds the code that runs when the `if` condition is false.

To try it in Ohmster, place a button across the center gap. Wire one of its legs to pin 2 and the leg diagonally across to the GND rail. Run the sketch, then press and hold the button on the bench.

> [!NOTE]
> Pull-ups make pressed read **LOW** and released read **HIGH**. It feels backwards at first. Some people write `bool pressed = digitalRead(buttonPin) == LOW;` (a `bool` is a variable that holds either true or false) so the rest of the code reads naturally.

## Key ideas

- `digitalRead` returns HIGH or LOW for an input pin.
- An unconnected input floats and reads randomly.
- A pull-up resistor holds the pin HIGH until the button connects it to GND.
- `INPUT_PULLUP` turns on the chip's built-in pull-up, so pressed reads LOW.

```quiz
Q: A button is wired between pin 2 and GND, with pinMode(2, INPUT_PULLUP). What does digitalRead(2) return while the button is pressed?
- [x] LOW
- [ ] HIGH
- [ ] A random value
- [ ] 2
= Pressing connects the pin directly to GND, which overpowers the weak internal pull-up, so the pin reads LOW.

Q: What is a "floating" input?
- [ ] An input connected to 5V
- [ ] An input connected to GND
- [x] An input connected to nothing, which reads randomly
- [ ] An input inside a loop
= With nothing holding it to a voltage, the pin picks up electrical noise and flips between HIGH and LOW unpredictably.

Q: Why is a pull-up resistor a high value like 10 kΩ rather than 10 Ω?
- [ ] High values are brighter
- [x] So only a tiny current flows when the button connects the pin to GND
- [ ] Low values don't fit on a breadboard
- [ ] It makes the button press faster
= When pressed, the resistor sits directly across 5 V and GND. 10 kΩ lets only 0.5 mA through; 10 Ω would let 500 mA through.
```
