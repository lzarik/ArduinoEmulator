You have been calling functions since Blink: `pinMode`, `digitalWrite` and `delay` are all functions someone else wrote. Writing your own lets you name a piece of work once and reuse it everywhere.

## Writing a function

```cpp
void blinkOnce(int pin, int ms)
{
  digitalWrite(pin, HIGH);
  delay(ms);
  digitalWrite(pin, LOW);
  delay(ms);
}
```

- `void` is the **return type**. `void` means the function gives nothing back.
- `blinkOnce` is its **name**.
- `int pin, int ms` are its **parameters**: values handed in by the **caller** (the code that calls the function).
- The block in braces is the **body**: what runs when it is called.

Now `blinkOnce(13, 200);` blinks pin 13 once, fast, and `blinkOnce(12, 1000);` blinks pin 12 slowly.

## Returning a value

A function can compute something and hand it back with `return`:

```cpp
bool buttonPressed(int pin)
{
  return digitalRead(pin) == LOW;   // with INPUT_PULLUP, pressed reads LOW
}
```

Its return type is `bool`, so it can be used anywhere a true/false value fits: `if (buttonPressed(2)) { ... }`.

## Try it: Morse code

Functions turn a messy sketch into something that reads like a description. This one blinks SOS, the distress signal, in **Morse code**, which spells letters with short flashes (dots) and long flashes (dashes). In the code, `*` means multiply:

```cpp try
const int ledPin = 13;
const int unit = 150;   // length of a dot, in milliseconds

void dot()
{
  digitalWrite(ledPin, HIGH);
  delay(unit);
  digitalWrite(ledPin, LOW);
  delay(unit);
}

void dash()
{
  digitalWrite(ledPin, HIGH);
  delay(unit * 3);
  digitalWrite(ledPin, LOW);
  delay(unit);
}

void letterS() { dot(); dot(); dot(); }
void letterO() { dash(); dash(); dash(); }

void setup()
{
  pinMode(ledPin, OUTPUT);
}

void loop()
{
  letterS();
  letterO();
  letterS();
  delay(unit * 7);
}
```

`loop()` now reads almost like English. Changing the timing means editing one number.

## What a call does inside the chip

When the CPU reaches `dot();` it has to jump to `dot`'s code, run it, and then come back to exactly where it left off. To come back, it needs to remember where it was. It saves that **return address** on the **stack**, an area at the top of RAM (the chip's working memory, the SRAM from the first lesson), then jumps. The stack works like a stack of plates: the last thing put on is the first thing taken off. At the end of `dot`, a return instruction takes the address back off the stack and jumps there.

Parameters travel in the CPU's registers. You will see both in action in the final unit, where you can watch the **stack pointer** (a register that keeps track of the top of the stack) drop by two bytes on every call in Ohmster's **debugger**, the panel in the Code tab that shows what's happening inside the chip.

## Key ideas

- A function has a return type, a name, parameters and a body.
- `void` functions do work; functions with a return type hand back a value with `return`.
- Good function names make `loop()` read like a description of what the sketch does.
- Calling a function saves a return address on the stack so the CPU can come back.

```quiz
Q: What does void mean in void blinkOnce(int pin, int ms)?
- [ ] The function takes no parameters
- [x] The function doesn't return a value
- [ ] The function is empty
- [ ] The function runs forever
= void is the return type, and it means "nothing". The parameters are listed separately in the brackets.

Q: What does this function return when its button (wired with INPUT_PULLUP) is pressed? bool buttonPressed(int pin) { return digitalRead(pin) == LOW; }
- [x] true
- [ ] false
- [ ] LOW
- [ ] The pin number
= Pressed reads LOW, so digitalRead(pin) == LOW is true, and that is what is returned.

Q: How does the CPU know where to go back to when a function finishes?
- [ ] It starts loop() over again
- [ ] The compiler copies the function into every place it is called
- [x] It saved the return address on the stack before jumping
- [ ] It searches the program for the call
= A call instruction pushes the address of the next instruction onto the stack. The return instruction pops it off and jumps back there.
```
