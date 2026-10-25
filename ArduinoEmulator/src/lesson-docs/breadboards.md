A breadboard lets you build circuits without **soldering** (joining parts permanently with melted metal). You push parts and wires into its holes, and metal strips hidden underneath connect them. Once you know which holes are connected, you can build almost anything.

## Strips of five

The middle of a breadboard is made of short metal strips, each joining **five holes**. Every numbered column has two of them: holes **a to e** above the center gap are connected to each other, and holes **f to j** below the gap form a separate group.

::diagram breadboard

So two parts are connected when one leg of each sits in the same strip. That is all a breadboard does.

> [!NOTE]
> Breadboards are often pictured turned the other way, so many guides call these strips "rows". Rows or columns, it is always a group of five on one side of the gap. Ohmster's bench is laid out like the diagram above.

## The center gap

The gap down the middle separates the two halves. Chips and push buttons **straddle** it (sit across it, with legs on both sides), so each of their pins lands in its own strip and none of them are **shorted** together (accidentally connected to each other).

## Power rails

Along each long edge are two **rails**, usually marked with a red + line and a blue − line. Unlike the short strips, each rail runs the **length of the board**. The usual setup:

1. Wire the Arduino's **5V** to a **+** rail.
2. Wire the Arduino's **GND** to a **−** rail.

Now any part can get 5 V or ground from the nearest hole on the rail, instead of every wire running back to the board.

## Building the LED circuit

Here is how the starter circuit in Ohmster is laid out:

1. A wire runs from **pin 13** to column 14.
2. The LED's **anode** sits in column 14, and its **cathode** in column 15.
3. The **resistor** bridges from column 15 to column 18.
4. A wire runs from column 18 to the **− rail**, which is connected to GND.

Follow it and you find one unbroken path: pin 13 → LED → resistor → GND.

> [!WARNING]
> The classic mistake is putting **both legs of a part in the same strip**. The strip connects them together, so current goes around the part instead of through it. If an LED won't light, check this first.

## Wiring in Ohmster

In the Design tab, pick a part from the parts panel at the top and click a hole to place it. To add a wire, click a hole, a rail, or one of the Arduino's header sockets to start it, then click where it should end. Hovering over any hole shows its name (such as "14a") in the hint at the bottom of the bench, which helps when you are following a circuit.

## Key ideas

- Each strip of five holes on one side of the gap (a–e or f–j in one column) is connected.
- The center gap separates the two halves, so chips and buttons straddle it.
- The + and − rails run the full length; connect them to 5V and GND.
- Never put both legs of a part in the same strip.

```quiz
Q: Which holes on a breadboard are connected together?
- [ ] Every hole in a column, from a all the way to j
- [x] The five holes on the same side of the center gap in one column, such as 4a to 4e
- [ ] All holes on the board
- [ ] No holes are connected; wires do everything
= Each group of five on one side of the gap shares a metal strip. The five on the other side of the gap are a separate group.

Q: An LED has both its legs in the same strip of five. What happens?
- [ ] It lights brighter
- [ ] It lights normally
- [x] It doesn't light, because the strip connects its legs together
- [ ] It catches fire
= The metal strip shorts the two legs together, so the current skips the LED entirely.

Q: What are the long rails along the edges usually used for?
- [ ] Holding chips
- [x] Supplying 5V and GND to the whole board
- [ ] Connecting to the internet
- [ ] Decoration
= Wiring 5V to the + rail and GND to the − rail gives every part on the board easy access to power and ground.
```
