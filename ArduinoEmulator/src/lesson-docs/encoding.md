An instruction like "load the number 32 into register 24" has to fit into 16 bits of flash. The ISA defines exactly how: some bits say which instruction it is, and the rest hold the operands. Once you know the patterns, you can read machine code by hand.

## Opcodes and operands

Every instruction word contains:

- An **opcode**: fixed bits that identify the instruction.
- **Operands**: **fields** (groups of bits) that say which registers, constants or addresses to use.

The AVR datasheet writes each instruction's format as a 16-character pattern. Fixed bits are `0` or `1`; letters mark operand fields: `d` for the destination register (where the result goes), `r` for a source register (where a value comes from), `K` for a constant, `k` for an address or **offset** (a distance to jump, counted from where you are now), `A` for an I/O address, `b` for a bit number.

## LDI: load immediate

`LDI Rd, K` loads the constant K into register Rd (read `Rd` as "register number d").

```text
1110 KKKK dddd KKKK
```

The opcode is the top four bits, `1110`. The 8-bit constant is split around a 4-bit register field.

Four bits can only count 0 to 15, so `dddd` is the register number **minus 16**. That is why `LDI` only works on R16 to R31: there is no room in the word to name the lower registers.

### Encoding LDI R24, 0x20

To follow along you need to read binary numbers. Binary works like ordinary numbers, but each place is worth double the one to its right: 1, 2, 4, 8, 16 and so on, instead of 1, 10, 100. So `1000` is 8, and `11000` is 16 + 8 = 24.

- Register 24 → 24 − 16 = 8 → `dddd` = `1000`
- Constant 0x20 → `0010 0000` → high half `0010`, low half `0000`

```text
1110 0010 1000 0000  =  0xE280
```

In flash, AVR stores the low byte first, so this appears in the .hex file as `80 E2`.

## ADD: add registers

`ADD Rd, Rr` sets Rd = Rd + Rr. Any of the 32 registers is allowed, so each needs 5 bits:

```text
0000 11rd dddd rrrr
```

The register fields are split up: one bit of `r` sits next to the opcode. For `ADD R24, R22`:

- d = 24 = `11000`
- r = 22 = `10110`, so the lone `r` bit is `1` and `rrrr` is `0110`

```text
0000 1111 1000 0110  =  0x0F86
```

## RJMP: relative jump

`RJMP k` jumps forward or backward by k words: PC ← PC + k + 1 (the arrow means "becomes").

```text
1100 kkkk kkkk kkkk
```

k is a 12-bit **signed** offset (signed means it can be negative, for a backward jump), so it reaches about 2048 words either way. The famous `0xCFFF` is `RJMP` with k = −1: PC ← PC − 1 + 1, a jump to itself. It is an **infinite loop** (a loop that never ends) in a single word, and avr-gcc, the compiler, puts one at the end of every program.

## SBI: set bit in I/O register

`SBI A, b` sets bit b of I/O register A:

```text
1001 1010 AAAA Abbb
```

For `SBI 0x05, 5` (set PB5, which is pin 13 HIGH): A = `00101`, b = `101`.

```text
1001 1010 0010 1101  =  0x9A2D
```

Five bits for A means SBI can only reach I/O addresses 0 to 31, the low half of the I/O registers. Luckily that is where the port registers live.

## Patterns at a glance

| Instruction | Format | Operands |
|---|---|---|
| `LDI Rd, K` | `1110 KKKK dddd KKKK` | R16–R31, constant 0–255 |
| `ADD Rd, Rr` | `0000 11rd dddd rrrr` | Any two registers |
| `SUB Rd, Rr` | `0001 10rd dddd rrrr` | Any two registers |
| `MOV Rd, Rr` | `0010 11rd dddd rrrr` | Any two registers |
| `RJMP k` | `1100 kkkk kkkk kkkk` | Offset −2048 to +2047 words |
| `SBI A, b` | `1001 1010 AAAA Abbb` | I/O 0–31, bit 0–7 |
| `CBI A, b` | `1001 1000 AAAA Abbb` | I/O 0–31, bit 0–7 |

> [!TIP]
> Ohmster's debugger shows the raw bytes of the current instruction under its name. Compile the register-level Blink from *I/O Ports*, find the `SBI` in the Program list, and check that its bytes are `2D 9A`.

## Key ideas

- An instruction word holds an opcode and operand fields.
- Field widths set limits: 4 register bits means LDI can only use R16–R31.
- Words are stored low byte first, so 0xE280 appears as 80 E2.
- 0xCFFF is RJMP to itself: an infinite loop.

```quiz
Q: Decode the word 0xE08F, which matches 1110 KKKK dddd KKKK.
- [ ] LDI R8, 0x0F
- [x] LDI R24, 0x0F
- [ ] LDI R24, 0xF0
- [ ] ADD R24, R15
= 0xE08F is 1110 0000 1000 1111. dddd = 1000 = 8, plus 16 is R24. K = 0000 then 1111 = 0x0F.

Q: Why can't LDI load a constant into R5?
- [ ] R5 is read-only
- [x] The register field has only 4 bits, enough for R16 to R31
- [ ] Constants can only go in even registers
- [ ] R5 holds the program counter
= Only 4 bits are free for the register in the LDI encoding, so it can name 16 registers. The ISA picks R16 to R31.

Q: The bytes 2D 9A appear in a .hex file. What instruction word is that?
- [ ] 0x2D9A
- [x] 0x9A2D
- [ ] 0xA9D2
- [ ] 0xD2A9
= AVR stores words low byte first, so 2D 9A is the word 0x9A2D, which is SBI 0x05, 5.
```
