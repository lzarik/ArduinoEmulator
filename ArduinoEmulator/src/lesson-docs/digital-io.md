You have already used `pinMode`, `digitalWrite` and `digitalRead`. This lesson pins down exactly what they do, so you can use any pin as an input or an output with confidence.

## A pin has three modes

```cpp
pinMode(pin, OUTPUT);        // the chip drives the pin HIGH or LOW
pinMode(pin, INPUT);         // the chip listens; the pin floats if unconnected
pinMode(pin, INPUT_PULLUP);  // the chip listens, with the built-in pull-up on
```

Every pin starts as `INPUT` when the board **resets** (restarts).

## Writing

`digitalWrite(pin, HIGH)` connects an output pin to 5 V inside the chip. `digitalWrite(pin, LOW)` connects it to 0 V. The pin can push current out (when HIGH, called **sourcing**) or pull current in (when LOW, called **sinking**), up to about 20 mA either way.

That means you can wire an LED two ways:

- Pin → resistor → LED → GND lights when the pin is **HIGH**.
- 5V → resistor → LED → pin lights when the pin is **LOW**.

## Reading

`digitalRead(pin)` returns `HIGH` or `LOW`. At 5 V, the ATmega328P reads anything above about **3 V** as HIGH and anything below about **1.5 V** as LOW. Voltages in between are not guaranteed either way, which is another reason inputs must never float.

## HIGH and LOW are just numbers

`HIGH` is defined as `1` and `LOW` as `0`. So you can store a pin's state in a variable, compare it, or flip it with `!` (read as "not", it turns 1 into 0 and 0 into 1):

```cpp
int state = digitalRead(2);         // 1 or 0
digitalWrite(13, !digitalRead(13)); // toggle pin 13
```

Reading an output pin returns the level it is currently driving, so the second line **toggles** pin 13 (switches it to the opposite state) every time it runs.

## Try it: two LEDs taking turns

Wire a second LED (with its resistor) to pin 12, then run this:

```cpp try
const int redPin = 13;
const int greenPin = 12;

void setup()
{
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
}

void loop()
{
  digitalWrite(redPin, HIGH);
  digitalWrite(greenPin, LOW);
  delay(400);

  digitalWrite(redPin, LOW);
  digitalWrite(greenPin, HIGH);
  delay(400);
}
```

## Try it: a button that toggles

The button sketch from the last unit lit the LED only *while* the button was held. To make each press flip the LED on or off, the program needs to notice the moment the button goes from released to pressed:

```cpp try
const int buttonPin = 2;
const int ledPin = 13;

int lastReading = HIGH;

void setup()
{
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop()
{
  int reading = digitalRead(buttonPin);
  if (lastReading == HIGH && reading == LOW) {
    digitalWrite(ledPin, !digitalRead(ledPin));  // just pressed: flip the LED
    delay(30);                                   // let the contacts settle
  }
  lastReading = reading;
}
```

> [!NOTE]
> `&&` means "and": both sides must be true. The program only acts when the button *was* up last time (`lastReading == HIGH`) *and* is down now (`reading == LOW`).
>
> Inside a button are two metal **contacts** that touch when you press it. Real contacts **bounce**: they make and break contact several times in the first few milliseconds of a press. The short `delay(30)` after a press is a simple way to ignore that bounce.

## Key ideas

- Pins are `OUTPUT`, `INPUT` or `INPUT_PULLUP`, and start as `INPUT`.
- An output can drive about 20 mA, either sourcing (HIGH) or sinking (LOW).
- At 5 V, inputs read above about 3 V as HIGH and below about 1.5 V as LOW.
- `HIGH` is 1 and `LOW` is 0, so pin states can be stored and flipped like numbers.

```quiz
Q: What mode is every pin in right after the board resets?
- [ ] OUTPUT
- [x] INPUT
- [ ] INPUT_PULLUP
- [ ] Off
= All pins start as plain inputs, so you must call pinMode(pin, OUTPUT) before driving one.

Q: What does digitalWrite(13, !digitalRead(13)) do?
- [ ] Turns pin 13 off forever
- [x] Flips pin 13: HIGH becomes LOW and LOW becomes HIGH
- [ ] Reads pin 13 twice
- [ ] Nothing, it is a syntax error
= Reading an output pin returns its current level, and ! turns 1 into 0 and 0 into 1, so the pin toggles.

Q: An LED is wired 5V → resistor → LED → pin 7. When does it light?
- [ ] When pin 7 is HIGH
- [x] When pin 7 is LOW
- [ ] Always
- [ ] Never
= Current only flows from 5V through the LED into the pin when the pin is at 0 V (LOW). When the pin is HIGH, both ends are at 5 V and no current flows.
```
