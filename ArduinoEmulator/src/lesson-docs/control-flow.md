Programs get interesting when they make decisions and repeat work. C++ gives you `if` to choose and `for` and `while` to repeat. On a microcontroller they work exactly as on any computer, with a couple of habits worth forming early.

## if and else

Imagine a sketch with a variable `temperature`, holding a reading from a temperature sensor, and a fan wired to the pin named `fanPin`:

```cpp
if (temperature > 30) {
  digitalWrite(fanPin, HIGH);
} else if (temperature < 25) {
  digitalWrite(fanPin, LOW);
} else {
  // between 25 and 30: leave the fan as it is
}
```

The condition in brackets is checked; if it is true, the code in its braces (called a **block**) runs and the rest are skipped.

### Comparing and combining

Symbols that compare or combine values are called **operators**:

| Operator | Means |
|---|---|
| `==` | equal to |
| `!=` | not equal to |
| `<` `>` `<=` `>=` | less than, greater than, and so on |
| `&&` | and: both must be true |
| `\|\|` | or: at least one must be true |
| `!` | not: flips true and false |

> [!WARNING]
> `=` **assigns** (stores a value in a variable) and `==` compares. `if (x = 5)` sets x to 5 and is always true. It compiles without complaint, so it's one of the most common **bugs** (mistakes in code) in C and C++.

## for loops

A `for` loop repeats a block a set number of times:

```cpp
for (int i = 0; i < 3; i++) {
  // runs with i = 0, then 1, then 2
}
```

The three parts are: start (`int i = 0`), keep going while (`i < 3`), and after each pass (`i++`, add one). Likewise `i--` subtracts one, which lets a loop count down.

Loops are perfect for a row of LEDs. Wire LEDs to pins 8 through 12, then run a light that sweeps back and forth:

```cpp try
void setup()
{
  for (int pin = 8; pin <= 12; pin++) {
    pinMode(pin, OUTPUT);
  }
}

void loop()
{
  // Sweep up...
  for (int pin = 8; pin <= 12; pin++) {
    digitalWrite(pin, HIGH);
    delay(80);
    digitalWrite(pin, LOW);
  }
  // ...and back down
  for (int pin = 11; pin >= 9; pin--) {
    digitalWrite(pin, HIGH);
    delay(80);
    digitalWrite(pin, LOW);
  }
}
```

## while loops

A `while` loop repeats as long as its condition is true, for however long that takes:

```cpp
// Wait here until the button (with INPUT_PULLUP) is pressed
while (digitalRead(2) == HIGH) {
  // do nothing
}
```

That is handy, but notice it **blocks** just like `delay()`. Nothing else happens until the button is pressed.

## The loop you already have

Remember that `loop()` itself is repeated forever. Often the cleanest design is to let `loop()` do the repeating and use `if` to decide what to do on each pass, rather than writing a `while` that traps the program. That keeps the sketch responsive, which is the same lesson as `millis()`.

## Key ideas

- `if`, `else if` and `else` choose which code runs.
- `==` compares, `=` assigns. Mixing them up compiles fine and breaks your logic.
- `for` repeats a set number of times; `while` repeats until a condition changes.
- Long `while` loops block, so prefer letting `loop()` do the repeating.

```quiz
Q: How many times does the body of for (int i = 0; i < 4; i++) run?
- [ ] 3
- [x] 4
- [ ] 5
- [ ] Forever
= It runs with i = 0, 1, 2 and 3, then stops when i reaches 4 because 4 < 4 is false.

Q: What is wrong with if (count = 10)?
- [ ] Nothing, it checks whether count is 10
- [x] It sets count to 10 and is always true
- [ ] It doesn't compile
- [ ] It checks whether count is not 10
= A single = assigns. The expression's value is 10, which counts as true, so the block always runs and count is overwritten.

Q: When is (a > 5 && b < 3) true?
- [ ] When either a > 5 or b < 3
- [x] Only when a > 5 and b < 3 are both true
- [ ] When neither is true
- [ ] Always
= && means "and": both sides must be true.
```
