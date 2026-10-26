export interface SREG {
    sregByte: number;
}

export interface MachineData {
    CommandToParse: CommandInformation;
    PC: number;
    DataSpace: number[];
    SP: number;
    StatusRegister: SREG;
}

export interface CommandInformation {
    CommandName: string;
    CommandBytes: number[];
    ProgramAddressByte?: number | null;
    SourceLineNumber?: number | null;
}

export interface CompileCodeResponse {
    hexText: string | null;
    elfBase64: string | null;
    instructions: CommandInformation[];
    errors: string[];
}


// Another API can be used by starting Vite with VITE_API_URL set
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5024';

export const findAllInstructions = async (dataLines: string[]): Promise<CommandInformation[]> => {
    const response = await fetch(`${API_BASE_URL}/Visualizer/FindAllInstructions`, { // no method body causes it to be called like a get
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataLines),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseJson = await response.json();

    return responseJson;
};

type RawInstruction = Record<string, unknown>;

// The backend has sent both PascalCase and camelCase property names over time; accept either.
const toCompileResponse = (raw: Record<string, unknown> | null): CompileCodeResponse => {
    const list = Array.isArray(raw?.instructions) ? (raw.instructions as RawInstruction[]) : [];
    return {
        hexText: (raw?.hexText as string) ?? null,
        elfBase64: (raw?.elfBase64 as string) ?? null,
        instructions: list.map((instruction) => ({
            CommandName: (instruction.CommandName ?? instruction.commandName ?? 'NO COMMAND FOUND') as string,
            CommandBytes: (instruction.CommandBytes ?? instruction.commandBytes ?? []) as number[],
            ProgramAddressByte: (instruction.ProgramAddressByte ?? instruction.programAddressByte ?? null) as number | null,
            SourceLineNumber: (instruction.SourceLineNumber ?? instruction.sourceLineNumber ?? null) as number | null,
        })),
        errors: Array.isArray(raw?.errors) ? (raw.errors as string[]) : [],
    };
};

export const compileCode = async (sourceCode: string): Promise<CompileCodeResponse> => {
    const response = await fetch(`${API_BASE_URL}/Visualizer/CompileCode`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(sourceCode),
    });

    if (!response.ok) {
        return {
            hexText: null,
            elfBase64: null,
            instructions: [],
            errors: [`HTTP error! ${response.statusText}`],
        };
    }

    return toCompileResponse(await response.json());
};

/** A progress update while compiling: a new stage starting, or a line of arduino-cli's progress output. */
export type CompileProgress = { type: 'stage'; stage: 'build' | 'decode' | 'map'; message: string } | { type: 'log'; message: string };

/**
 * Compiles and reports progress as it goes (build, decode, map stages and arduino-cli's step messages).
 * Falls back to the plain endpoint when talking to an older API without streaming.
 */
export const compileCodeStream = async (
    sourceCode: string,
    onProgress: (progress: CompileProgress) => void,
): Promise<CompileCodeResponse> => {
    const response = await fetch(`${API_BASE_URL}/Visualizer/CompileCodeStream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceCode),
    });

    if (response.status === 404 || !response.body) {
        onProgress({ type: 'stage', stage: 'build', message: 'Building the sketch with arduino-cli' });
        return compileCode(sourceCode);
    }
    if (!response.ok) {
        return { hexText: null, elfBase64: null, instructions: [], errors: [`HTTP error! ${response.statusText}`] };
    }

    // The response is newline-delimited JSON: progress events, then one "result".
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    for (;;) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        let newline;
        while ((newline = buffered.indexOf('\n')) >= 0) {
            const line = buffered.slice(0, newline).trim();
            buffered = buffered.slice(newline + 1);
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.type === 'result') return toCompileResponse(event);
            onProgress(event as CompileProgress);
        }
        if (done) break;
    }
    return { hexText: null, elfBase64: null, instructions: [], errors: ['The compiler stopped without sending a result.'] };
};

// --- Server-side emulator session --------------------------------------------------------------

/** Machine snapshot from the backend emulator. `pc` is a word address; `index` is the instruction's position in the program list (-1 if none). */
export interface EmulatorState {
    pc: number;
    index: number;
    cycles: number;
    dataSpace: number[];
    error: string | null;
    /** True while the program runs in the background (startEmulator) */
    running?: boolean;
    /** How fast a background run is really going, as a fraction of the speed asked for (1 = keeping up) */
    speed?: number | null;
}

/** Input pin levels from the breadboard, as PINB/PINC/PIND bit masks. */
export interface PinInputs {
    b: number;
    c: number;
    d: number;
}

const emulatorPost = async (path: string, body?: unknown): Promise<EmulatorState> => {
    const response = await fetch(`${API_BASE_URL}/Emulator/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Emulator request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
};

export const loadEmulator = (dataLines: string[]) => emulatorPost('Load', dataLines);
export const resetEmulator = () => emulatorPost('Reset');
export const stepEmulator = (inputs: PinInputs) => emulatorPost('Step', { cycles: 0, inputs });
/** Runs up to `cycles` clock cycles (16,000 per emulated millisecond). */
export const runEmulator = (cycles: number, inputs: PinInputs) => emulatorPost('Run', { cycles: Math.round(cycles), inputs });
/** Runs the program on the server in the background at `speed` × real time; calling it again changes the speed. */
export const startEmulator = (speed: number, inputs: PinInputs) => emulatorPost('Start', { speed, inputs });
/** The latest snapshot of a background run, sending the breadboard's inputs. Poll it or the run stops after 3 s. */
export const pollEmulator = (inputs: PinInputs) => emulatorPost('Poll', inputs);
export const stopEmulator = () => emulatorPost('Stop');
