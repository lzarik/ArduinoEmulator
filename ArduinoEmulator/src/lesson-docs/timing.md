`delay()` is the easiest way to wait, and it causes the most trouble once a sketch has to do two things at once. This lesson introduces `millis()`, the tool that fixes it.

## delay() stops everything

While `delay(1000)` runs, the CPU does nothing useful for a whole second. It can't check a button, update another LED, or respond to anything. For Blink that's fine. For a sketch that blinks an LED *and* watches a button, the button only gets checked between delays, so presses are missed. A function like `delay()` that holds everything up until it's finished is called **blocking**.

## millis(): a clock that never stops

`millis()` returns the number of milliseconds since the board started. It keeps counting in the background no matter what your code is doing, and returns an `unsigned long`.

Instead of waiting, you can *check the clock* and only act when enough time has passed (`>=` means "greater than or equal to"):

```cpp try
const int ledPin = 13;
const unsigned long interval = 500;

unsigned long lastToggle = 0;

void setup()
{
  pinMode(ledPin, OUTPUT);
}

void loop()
{
  unsigned long now = millis();
  if (now - lastToggle >= interval) {
    lastToggle = now;
    digitalWrite(ledPin, !digitalRead(ledPin));
  }

  // loop() keeps running here, thousands of times a second,
  // free to check buttons or blink other LEDs.
}
```

The LED blinks exactly as before, but `loop()` never stops. It spins around thousands of times per second, and only flips the LED when the clock says it's time.

## Two things at once

With `millis()`, running two rhythms is just two copies of the same pattern. Wire an LED to pin 12 and try this:

```cpp try
unsigned long lastRed = 0;
unsigned long lastGreen = 0;

void setup()
{
  pinMode(13, OUTPUT);
  pinMode(12, OUTPUT);
}

void loop()
{
  unsigned long now = millis();

  if (now - lastRed >= 500) {
    lastRed = now;
    digitalWrite(13, !digitalRead(13));
  }

  if (now - lastGreen >= 130) {
    lastGreen = now;
    digitalWrite(12, !digitalRead(12));
  }
}
```

That would be very awkward with `delay()`.

## Why "now − last ≥ interval"

`millis()` counts in an `unsigned long`, which runs out after about 49.7 days and **rolls over** (wraps back to 0, like the counter overflow in *Variables and Types*). Writing the check as `now - lastToggle >= interval` keeps working across that wrap, because unsigned subtraction wraps the same way. Writing `now >= lastToggle + interval` does not. Always subtract.

> [!NOTE]
> How does `millis()` keep counting while your code runs? A **hardware timer** (a counting circuit built into the chip) ticks along on its own and **interrupts** the CPU about once a millisecond: it briefly pauses your code to run a tiny job that updates the count, then lets your code carry on. You will see exactly how in *Timers and Interrupts*. Ohmster emulates that timer, which is why `millis()` and `delay()` work in the emulator.

## Key ideas

- `delay()` blocks: nothing else happens while it waits.
- `millis()` returns milliseconds since start-up as an `unsigned long`.
- Check `now - last >= interval` instead of waiting, and `loop()` stays free.
- Always store times in `unsigned long` and subtract, so rollover can't break the check.

```quiz
Q: What type should you store millis() values in?
- [ ] int
- [ ] byte
- [x] unsigned long
- [ ] float
= millis() returns an unsigned long. An int would overflow after about 33 seconds.

Q: What is the main problem with using delay() in a sketch that also reads a button?
- [x] The button isn't checked while the delay is running, so presses can be missed
- [ ] delay() uses too much memory
- [ ] delay() makes the LED dimmer
- [ ] delay() stops millis() from counting
= delay() keeps the CPU busy waiting, so no other code runs until it returns.

Q: Which check keeps working after millis() rolls over to 0?
- [ ] millis() >= last + interval
- [x] millis() - last >= interval
- [ ] millis() == last + interval
- [ ] millis() > interval
= Unsigned subtraction wraps around the same way the counter does, so the difference stays correct across the rollover.
```
