import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react'
import './monacoSetup'
import './Workbench.css'
import { findAllInstructions, compileCodeStream, loadEmulator, resetEmulator, runEmulator, stepEmulator } from './api'
import type { CommandInformation, EmulatorState, MachineData, PinInputs } from './api'
import { Workbench, type Tool } from './Workbench'
import { Debugger } from './Debugger'
import { PartsPalette } from './PartsPalette'
import { NewProjectDialog } from './NewProjectDialog'
import { LogoMenu, ProjectMenu } from './HeaderMenus'
import { HomeScreen, type HomeSection } from './HomeScreen'
import { cliProgress, seconds, stepProgress, type BuildState, type OutputLine } from './buildLog'
import { OutputPanel, StatusBar } from './OutputPanel'
import { WIRE_COLORS, evaluateCircuit, type Circuit, type LedColor } from './circuit'
import { loadProjects, newProject, storeProjects, type Project } from './projects'

function ConvertHexToNumber(hexDigits: string): number { return parseInt(hexDigits, 16); }

function ParseHexDataLines(hexContent: string): string[] {
  const lines = hexContent.split(/\r?\n/);
  const parsedDataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !line.startsWith(':')) continue;

    const dataCountHex = line.slice(1, 3);
    const recordTypeHex = line.slice(7, 9);

    const dataCount = ConvertHexToNumber(dataCountHex);
    const recordType = ConvertHexToNumber(recordTypeHex);

    if (Number.isNaN(dataCount) || Number.isNaN(recordType)) continue;
    if (recordType !== 0 || dataCount <= 0) continue;

    const data = line.slice(9, 9 + (2 * dataCount));
    if (data.length === 2 * dataCount) {
      parsedDataLines.push(data);
    }
  }

  return parsedDataLines;
}

function ConvertElfBase64ToHexDump(elfBase64: string): string {
  try {
    const decoded = atob(elfBase64);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));

    const maxPreviewBytes = 8192;
    const preview = bytes.slice(0, maxPreviewBytes);
    const lines: string[] = [];

    for (let index = 0; index < preview.length; index += 16) {
      const chunk = preview.slice(index, index + 16);
      const hex = Array.from(chunk)
        .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      const offset = index.toString(16).padStart(8, '0').toUpperCase();
      lines.push(`${offset}: ${hex}`);
    }

    if (bytes.length > maxPreviewBytes) {
      lines.push('');
      lines.push(`... truncated preview (${maxPreviewBytes} of ${bytes.length} bytes shown)`);
    }

    return lines.join('\n');
  }
  catch {
    return 'Unable to decode ELF payload.';
  }
}

const arduinoCompletionLabels = [
  'pinMode',
  'digitalWrite',
  'digitalRead',
  'analogRead',
  'analogWrite',
  'delay',
  'millis',
  'Serial.begin',
  'Serial.print',
  'Serial.println',
  'setup',
  'loop'
];

const CLOCK_HZ = 16_000_000;
const DATA_SIZE = 0x900;

const freshMachine = (): MachineData => ({
  CommandToParse: { CommandName: 'NONE', CommandBytes: [] },
  PC: 0,
  DataSpace: new Array(DATA_SIZE).fill(0),
  SP: DATA_SIZE - 1,
  StatusRegister: { sregByte: 0 },
});

// The machine as the debugger and breadboard see it, built from a backend snapshot. SP and SREG
// live in their I/O registers (0x5D-0x5F), as on the real chip.
const machineFromState = (state: EmulatorState): MachineData => ({
  CommandToParse: { CommandName: 'NONE', CommandBytes: [] },
  PC: state.pc,
  DataSpace: state.dataSpace,
  SP: state.dataSpace[0x5d] | (state.dataSpace[0x5e] << 8),
  StatusRegister: { sregByte: state.dataSpace[0x5f] },
});

const CALL_INSTRUCTIONS = new Set(['CALL', 'RCALL', 'ICALL']);

// The line of the sketch that called into the code running now, found from the stack: every CALL pushes
// the address it will return to (as a word address, high byte just above the low byte). Walking up from
// the stack pointer, the first return address that follows a CALL made by a line of the sketch tells
// which line it was, however deep in library code the program is.
function callingSketchLine(data: number[], sp: number, commands: CommandInformation[], indexByAddress: Map<number, number>) {
  for (let a = sp + 1; a + 1 < Math.min(data.length, 0x900); a++) {
    const i = indexByAddress.get(((data[a] << 8) | data[a + 1]) * 2);
    if (!i) continue;
    const call = commands[i - 1];
    if (CALL_INSTRUCTIONS.has(call.CommandName) && call.SourceLineNumber != null) return call.SourceLineNumber;
  }
  return null;
}

// Run speeds: one instruction at a time (watch the debugger), slowed-down time, or real time.
const SPEEDS = [
  { label: 'Instruction', kind: 'step', delay: 250 },
  { label: '1/20×', kind: 'time', factor: 0.05 },
  { label: 'Real time', kind: 'time', factor: 1 },
] as const;

// How often the run loop asks the backend for the next slice of emulated time.
const FRAME_MS = 33;

type Tab = 'code' | 'design';

const TAB_LABELS: Record<Tab, string> = { code: 'Code', design: 'Design' };

// The steps shown while compiling a sketch or loading a .hex file.
const COMPILE_STEPS = [
  { id: 'build', label: 'Build sketch' },
  { id: 'decode', label: 'Decode instructions' },
  { id: 'map', label: 'Match to source lines' },
  { id: 'load', label: 'Load into emulator' },
];
const HEX_STEPS = [
  { id: 'decode', label: 'Decode instructions' },
  { id: 'load', label: 'Load into emulator' },
];

const formatCommandBytes = (bytes: number[]) =>
  bytes.map((b) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ');

const DEBUGGER_KEY = 'ohmster.debugger';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

// Compiler messages name the sketch by its full temporary path (/private/var/folders/…/GeneratedSketch.ino:14:2);
// shorten that to sketch.ino:14:2.
const tidyCompilerMessage = (message: string) => message.replace(/(?:\/[^\s/:]+)+\/[^\s/:]+\.ino\b/g, 'sketch.ino');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App({ onExit }: { onExit: () => void })
{

  // Projects ----------------------------------------------------------------------------------------
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [project, setProject] = useState<Project>(() => loadProjects()[0] ?? newProject('My first project'));
  const [projectName, setProjectName] = useState(project.name);
  const [codeInput, setCodeInput] = useState(project.code);
  const [circuit, setCircuit] = useState<Circuit>(project.circuit);
  // Starts clean: either the most recent saved project, or an untouched placeholder (with no saved
  // projects, the home screen asks for a new one before the workspace opens).
  const [dirty, setDirty] = useState(false);

  // Signing in lands on the home screen; opening or creating a project switches to the workspace.
  const [view, setView] = useState<'home' | 'workspace'>('home');
  const [homeSection, setHomeSection] = useState<HomeSection>('projects');
  const [visitedWorkspace, setVisitedWorkspace] = useState(false);
  const [naming, setNaming] = useState(false);

  // Workspace ---------------------------------------------------------------------------------------
  const [tab, setTab] = useState<Tab>('code');
  const [codeSource, setCodeSource] = useState<'sketch' | 'hex'>('sketch');
  // The debugger can be hidden for a full-width editor or bench; remembered between visits
  const [debuggerOpen, setDebuggerOpen] = useState(() => {
    try {
      return localStorage.getItem(DEBUGGER_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  // Progress of the current compile or load, shown step by step.
  const [build, setBuild] = useState<BuildState | null>(null);
  const [now, setNow] = useState(() => performance.now());
  // The Output panel opens by itself when a build starts; the status bar opens and closes it too.
  const [outputOpen, setOutputOpen] = useState(false);
  const [outputHeight, setOutputHeight] = useState(210);
  const [freshSuccess, setFreshSuccess] = useState(false);
  const freshSuccessTimer = useRef<number | undefined>(undefined);
  // What the Output panel shows: the latest build's log, then any errors from running the program
  const [outputLog, setOutputLog] = useState<OutputLine[]>([]);
  // After a successful build the panel closes by itself; a failed one keeps it open
  const outputCloseTimer = useRef<number | undefined>(undefined);
  const buildInfoRef = useRef({ title: '', startedAt: 0 });
  const [tool, setTool] = useState<Tool>({ kind: 'select' });
  const [ledColor, setLedColor] = useState<LedColor>('red');
  const [wireColor, setWireColor] = useState(WIRE_COLORS[0]);
  const [pressed, setPressed] = useState<Set<string>>(new Set());

  // Emulator ----------------------------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hexTab, setHexTab] = useState<'hex' | 'elf' | 'unknown' | 'errors'>('hex');
  const [commands, setCommands] = useState<CommandInformation[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [hexText, setHexText] = useState<string>("");
  const [elfText, setElfText] = useState<string>("");
  const [dataLines, setDataLines] = useState<string[]>([]);
  const [instructionPosition, setInstructionPosition] = useState(0);
  // The line of the sketch the current instruction belongs to. Inside library code (digitalWrite, delay…)
  // that has no line of its own, it's the sketch line that called into it, found from the stack.
  const [sketchLine, setSketchLine] = useState<{ line: number; inLibrary: boolean } | null>(null);
  const lastSketchLineRef = useRef<number | null>(null);
  // Program index of the instruction at each flash byte address, for following return addresses
  const indexByAddressRef = useRef(new Map<number, number>());
  const [machineData, setMachineData] = useState<MachineData>(freshMachine);
  const [changedRegisters, setChangedRegisters] = useState<Set<number>>(new Set());
  const [cycles, setCycles] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // What the loaded program was built from: the sketch text it was compiled from, or a .hex file.
  const [compiledFrom, setCompiledFrom] = useState<string | null>(null);

  // The run loop reads these instead of state so it always sees the latest values.
  const commandsRef = useRef(commands);
  const machineRef = useRef(machineData);
  const runningRef = useRef(false);
  const circuitRef = useRef(circuit);
  const pressedRef = useRef(pressed);
  const speedRef = useRef(speed);
  useEffect(() => {
    commandsRef.current = commands;
    circuitRef.current = circuit;
    pressedRef.current = pressed;
    speedRef.current = speed;
  }, [commands, circuit, pressed, speed]);

  // Editor ------------------------------------------------------------------------------------------
  const [isMonacoConfigured, setIsMonacoConfigured] = useState(false);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);
  const monacoEditorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const highlightedDecorationIdsRef = useRef<string[]>([]);

  const circuitState = useMemo(
    () => evaluateCircuit(circuit, pressed, machineData.DataSpace),
    [circuit, pressed, machineData],
  );

  const unknownInstructions = commands.filter((command) => command.CommandName === 'NO COMMAND FOUND');

  const markDirty = () => setDirty(true);

  const clearHighlightedSourceLine = () => {
    if (!monacoEditorRef.current) {
      return;
    }

    highlightedDecorationIdsRef.current = monacoEditorRef.current.deltaDecorations(
      highlightedDecorationIdsRef.current,
      []);
  };

  // Highlights a line of the sketch in the same amber as the debugger's current instruction: solid for the
  // line the instruction came from, lighter with a dashed edge while inside library code it called.
  const highlightSourceLine = (lineNumber: number, inLibrary = false) => {
    if (!monacoEditorRef.current || !monacoRef.current || lineNumber <= 0) {
      return;
    }

    const model = monacoEditorRef.current.getModel();
    if (!model || lineNumber > model.getLineCount()) {
      return;
    }

    highlightedDecorationIdsRef.current = monacoEditorRef.current.deltaDecorations(
      highlightedDecorationIdsRef.current,
      [{
        range: new monacoRef.current.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: inLibrary ? 'source-line-library' : 'source-line-current',
          linesDecorationsClassName: inLibrary ? 'source-line-library-gutter' : 'source-line-current-gutter',
        },
      }]);

    // Scroll only when the line is off screen, so a running program doesn't make the editor jump
    monacoEditorRef.current.revealLineInCenterIfOutsideViewport(lineNumber);
  };

  // Keep the editor's highlight on the current instruction's line, whether stepping or running.
  useEffect(() => {
    if (sketchLine) highlightSourceLine(sketchLine.line, sketchLine.inLibrary);
    else clearHighlightedSourceLine();
  }, [sketchLine]);

  // Emulator controls ---------------------------------------------------------------------------------
  // The program runs on the backend emulator, which keeps the machine between requests. Each step or
  // slice of run time returns a snapshot that drives the debugger and the breadboard.

  const stop = () => {
    runningRef.current = false;
    setRunning(false);
  };

  // Show a snapshot from the backend, flashing the registers that changed since the last one.
  const applyState = (state: EmulatorState) => {
    const previous = machineRef.current.DataSpace;
    const changed = new Set<number>();
    for (let r = 0; r < 32; r++) if (state.dataSpace[r] !== previous[r]) changed.add(r);
    const machine = machineFromState(state);
    machineRef.current = machine;
    setMachineData(machine);
    setInstructionPosition(state.index);
    const own = commandsRef.current[state.index]?.SourceLineNumber ?? null;
    if (own != null) lastSketchLineRef.current = own;
    const line =
      own ??
      callingSketchLine(state.dataSpace, machine.SP, commandsRef.current, indexByAddressRef.current) ??
      lastSketchLineRef.current;
    setSketchLine((prev) =>
      line == null ? null : prev?.line === line && prev.inLibrary === (own == null) ? prev : { line, inLibrary: own == null },
    );
    setChangedRegisters(changed);
    setCycles(state.cycles);
    if (state.error) {
      stop();
      reportError(`The program stopped: ${state.error}`);
    }
  };

  // Input pin levels for the backend, read from the breadboard.
  const currentInputs = (): PinInputs => {
    const pins = evaluateCircuit(circuitRef.current, pressedRef.current, machineRef.current.DataSpace).pinRegisters;
    return { b: pins.B, c: pins.C, d: pins.D };
  };

  // Restart the program. The board's reset button keeps it running, like a real board; the Reset
  // button in the Run panel stops it.
  const resetMachine = async ({ keepRunning = false } = {}) => {
    if (!keepRunning) stop();
    lastSketchLineRef.current = null;
    setSketchLine(null);
    if (commandsRef.current.length === 0) return;
    try {
      applyState(await resetEmulator());
      setErrorMessages([]);
    } catch (e) {
      reportError(errorText(e, 'Failed to reset the emulator'));
    }
  };

  const loadProgram = async (instructions: CommandInformation[], lines: string[]) => {
    stop();
    lastSketchLineRef.current = null;
    setSketchLine(null);
    commandsRef.current = instructions;
    indexByAddressRef.current = new Map(
      instructions.flatMap((c, i) => (c.ProgramAddressByte != null ? [[c.ProgramAddressByte, i] as const] : [])),
    );
    setCommands(instructions);
    machineRef.current = freshMachine();
    if (instructions.length === 0) {
      setMachineData(machineRef.current);
      setInstructionPosition(0);
      setCycles(0);
      return;
    }
    applyState(await loadEmulator(lines));
  };

  const handleStep = async () => {
    try {
      applyState(await stepEmulator(currentInputs()));
    } catch (e) {
      reportError(errorText(e, 'Failed to run instruction'));
    }
  };

  // Runs until stopped: the program's loop() runs forever, just like on a board.
  const handleRun = async () => {
    if (runningRef.current || commandsRef.current.length === 0) return;
    runningRef.current = true;
    setRunning(true);
    setErrorMessages([]);
    try {
      let last = performance.now();
      while (runningRef.current) {
        const mode = SPEEDS[speedRef.current];
        if (mode.kind === 'step') {
          applyState(await stepEmulator(currentInputs()));
          await sleep(mode.delay);
          last = performance.now();
          continue;
        }
        // Ask for as much emulated time as real time has passed (scaled by the speed), capped so a
        // stall doesn't turn into one enormous request.
        const now = performance.now();
        const elapsed = Math.min(now - last, 250);
        last = now;
        applyState(await runEmulator((elapsed / 1000) * CLOCK_HZ * mode.factor, currentInputs()));
        const spent = performance.now() - now;
        if (spent < FRAME_MS) await sleep(FRAME_MS - spent);
      }
    } catch (e) {
      reportError(errorText(e, 'Failed to run the program'));
    } finally {
      stop();
    }
  };

  const processHexFileContent = async (content: string) => {
    setHexText(content);
    setElfText("");
    await loadProgram([], []);
    const lines = ParseHexDataLines(content);
    setDataLines(lines);
    if (lines.length === 0) {
      reportError('No instruction data records found in HEX file.');
      setHexTab('errors');
      return;
    }
    setErrorMessages([]);
    setHexTab('hex');
    await convertToInstructions(lines);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => processHexFileContent(e.target?.result as string);
      reader.readAsText(file);
    }
    event.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.hex')) return;
    const reader = new FileReader();
    reader.onload = (ev) => processHexFileContent(ev.target?.result as string);
    reader.readAsText(file);
  };

  // --- Build progress ---------------------------------------------------------------------------

  const appendOutput = (...lines: OutputLine[]) => setOutputLog((log) => [...log, ...lines]);

  const showOutput = (open: boolean) => {
    window.clearTimeout(outputCloseTimer.current);
    setOutputOpen(open);
  };

  // A problem while running the program (or loading a file) goes to the Output panel, which opens to show it.
  const reportError = (message: string) => {
    setErrorMessages([message]);
    appendOutput({ text: message, kind: 'error' });
    showOutput(true);
  };

  // The build log reads like Visual Studio's Output window: a header, a "1>" line for every step and every
  // progress line from arduino-cli, then a one-line summary.
  const startBuild = (title: string, steps: { id: string; label: string }[], what: string) => {
    window.clearTimeout(freshSuccessTimer.current);
    setFreshSuccess(false);
    showOutput(true);
    const startedAt = performance.now();
    buildInfoRef.current = { title, startedAt };
    setBuild({ title, startedAt, steps: steps.map((st) => ({ ...st, status: 'pending' as const })), progress: 0 });
    setOutputLog([
      { text: `${title} started at ${new Date().toLocaleTimeString()}...`, kind: 'muted' },
      { text: `1>------ ${title} started: ${what}, Board: Arduino Uno (ATmega328P) ------` },
    ]);
  };

  const advance = (progress?: number) => {
    if (progress != null) setBuild((b) => b && { ...b, progress: Math.max(b.progress, progress) });
  };

  // Finish the step in progress and start the next one.
  const enterStep = (id: string, detail?: string) => {
    setBuild((b) => {
      if (!b) return b;
      const t = performance.now();
      return {
        ...b,
        steps: b.steps.map((st) =>
          st.id === id
            ? { ...st, status: 'active' as const, startedAt: t }
            : st.status === 'active'
              ? { ...st, status: 'done' as const, endedAt: t }
              : st,
        ),
      };
    });
    appendOutput({ text: `1>${detail ?? id}` });
    advance(stepProgress(id));
  };

  // A progress line from arduino-cli
  const stepDetail = (detail: string) => {
    appendOutput({ text: `1>${detail}` });
    advance(cliProgress(detail));
  };

  const endBuild = (ok: boolean, errors: string[] = []) => {
    const { title, startedAt } = buildInfoRef.current;
    const elapsed = seconds(performance.now() - startedAt);
    appendOutput(
      ...errors.map((e): OutputLine => ({ text: `1>${e}`, kind: 'error' })),
      ok
        ? { text: `========== ${title}: 1 succeeded, 0 failed, ${elapsed} ==========`, kind: 'success' }
        : { text: `========== ${title}: 0 succeeded, 1 failed, ${elapsed} ==========`, kind: 'error' },
    );
    setBuild((b) => {
      if (!b) return b;
      const t = performance.now();
      return {
        ...b,
        endedAt: t,
        failed: !ok,
        progress: ok ? 1 : b.progress,
        // On success, steps that weren't reported separately (an older API does them all in one go) count as done.
        steps: b.steps.map((st) =>
          st.status === 'active'
            ? { ...st, status: ok ? 'done' : 'error', endedAt: t }
            : ok && st.status === 'pending'
              ? { ...st, status: 'done' }
              : st,
        ),
      };
    });
    if (ok) {
      setFreshSuccess(true);
      freshSuccessTimer.current = window.setTimeout(() => setFreshSuccess(false), 5000);
      outputCloseTimer.current = window.setTimeout(() => setOutputOpen(false), 2500);
    }
  };

  // Tick the elapsed times while something is in progress.
  useEffect(() => {
    if (!build || build.endedAt) return;
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, [build]);

  const convertToInstructions = async (lines = dataLines) => {
    try {
      setLoading(true);
      setErrorMessages([]);

      if (lines.length === 0) {
        throw new Error('No HEX instruction data available. Upload or compile code first.');
      }

      startBuild('Load', HEX_STEPS, 'File: .hex');
      enterStep('decode', `Decoding ${lines.length} lines of hex data`);
      const instructions = await findAllInstructions(lines);
      enterStep('load', `Loading ${instructions.length} instructions into the emulator`);
      await loadProgram(instructions, lines);
      setCompiledFrom('hex');
      endBuild(true);
    } catch (e) {
      endBuild(false, [errorText(e, 'Failed to convert to instructions')]);
      setErrorMessages([errorText(e, 'Failed to convert to instructions')]);
      setHexTab('errors');
    } finally {
      setLoading(false);
    }
  };

  // Compiles the sketch and loads it. Returns whether there is a program to run.
  const handleCompileCode = async () => {
    try {
      setLoading(true);
      setErrorMessages([]);
      startBuild('Build', COMPILE_STEPS, `Sketch: ${projectName.trim() || 'Untitled project'}`);
      const result = await compileCodeStream(codeInput, (progress) => {
        if (progress.type === 'stage') enterStep(progress.stage, progress.message);
        else stepDetail(progress.message);
      });

      if (result.errors.length > 0 || !result.hexText) {
        const errors = result.errors.length > 0 ? result.errors.map(tidyCompilerMessage) : ['Failed to compile code'];
        endBuild(false, errors);
        setElfText("");
        setErrorMessages(errors);
        return false;
      }

      setHexText(result.hexText);
      setElfText(result.elfBase64 ? ConvertElfBase64ToHexDump(result.elfBase64) : 'No compiled ELF payload returned.');

      const lines = ParseHexDataLines(result.hexText);
      setDataLines(lines);
      if (lines.length === 0) {
        endBuild(false, ['Compilation succeeded but no HEX instruction data records were found.']);
        setErrorMessages(['Compilation succeeded but no HEX instruction data records were found.']);
        return false;
      }

      const instructions = result.instructions.length > 0 ? result.instructions : await findAllInstructions(lines);
      enterStep('load', `Loading ${instructions.length} instructions into the emulator`);
      await loadProgram(instructions, lines);
      setCompiledFrom(codeInput);
      endBuild(true);
      return true;
    }
    catch (e) {
      endBuild(false, [errorText(e, 'Failed to compile code')]);
      setErrorMessages([errorText(e, 'Failed to compile code')]);
      return false;
    }
    finally {
      setLoading(false);
    }
  };

  // Run from either tab: compiles first if the sketch changed since the last build. Compile errors
  // switch to the Code tab so they're visible.
  const needsCompile = compiledFrom !== 'hex' && compiledFrom !== codeInput;
  const handleRunClick = async () => {
    if (needsCompile && !(await handleCompileCode())) {
      setTab('code');
      setCodeSource('sketch');
      return;
    }
    handleRun();
  };

  const handleCodeEditorMount: OnMount = (editor, monaco) => {
    monacoEditorRef.current = editor;
    monacoRef.current = monaco;
    editor.focus();
    // The editor measures character widths at startup; measure again once the web font arrives.
    document.fonts.ready.then(() => monaco.editor.remeasureFonts());

    if (isMonacoConfigured) {
      return;
    }

    completionProviderRef.current?.dispose();
    completionProviderRef.current = monaco.languages.registerCompletionItemProvider('cpp', {
      triggerCharacters: ['.', '>'],
      provideCompletionItems: (model: Monaco['editor']['ITextModel'], position: Monaco['Position']) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const keywordSuggestions = arduinoCompletionLabels.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: label.includes('.') ? `${label}($1);` : `${label}($1);`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }));

        return {
          suggestions: [
            {
              label: 'setup/loop template',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'void setup()\n{\n  $1\n}\n\nvoid loop()\n{\n  $2\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Arduino sketch template.',
              range,
            },
            {
              label: '#include <Arduino.h>',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '#include <Arduino.h>',
              documentation: 'Arduino core include.',
              range,
            },
            ...keywordSuggestions,
          ],
        };
      },
    });

    setIsMonacoConfigured(true);
  };

  // Projects ----------------------------------------------------------------------------------------

  const saveProject = useCallback(() => {
    const saved: Project = { ...project, name: projectName.trim() || 'Untitled project', code: codeInput, circuit, updatedAt: Date.now() };
    const list = [saved, ...projects.filter((p) => p.id !== saved.id)];
    storeProjects(list);
    setProjects(list);
    setProject(saved);
    setProjectName(saved.name);
    setDirty(false);
  }, [project, projectName, codeInput, circuit, projects]);

  const openProject = (p: Project, discardChanges = false) => {
    if (dirty && !discardChanges && !window.confirm('Discard unsaved changes to the current project?')) return false;
    setProject(p);
    setProjectName(p.name);
    setCodeInput(p.code);
    setCircuit(p.circuit);
    setDirty(!projects.some((saved) => saved.id === p.id));
    setPressed(new Set());
    setCompiledFrom(null);
    setHexText('');
    setElfText('');
    setErrorMessages([]);
    loadProgram([], []);
    return true;
  };

  // "Open in editor" on a lesson's example: a new, unsaved project holding that code.
  const tryLessonCode = (code: string, lessonTitle: string) => {
    if (!openProject({ ...newProject(lessonTitle), code })) return;
    setTab('code');
    setCodeSource('sketch');
    enterWorkspace();
  };

  const deleteProject = (p: Project) => {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    const list = projects.filter((saved) => saved.id !== p.id);
    storeProjects(list);
    setProjects(list);
    if (p.id === project.id) setDirty(true);
  };

  // Home screen -------------------------------------------------------------------------------------

  const enterWorkspace = () => {
    setVisitedWorkspace(true);
    setView('workspace');
  };

  const goHome = () => {
    if (running) stop();
    setView('home');
  };

  // A new project is named up front and saved straight away, so it shows on the home screen.
  const createProject = (name: string) => {
    const created = newProject(name);
    if (!openProject(created)) return;
    const list = [created, ...projects];
    storeProjects(list);
    setProjects(list);
    setDirty(false);
    setNaming(false);
    setTab('code');
    setCodeSource('sketch');
    enterWorkspace();
  };

  const openFromHome = (p: Project) => {
    if (p.id !== project.id && !openProject(p)) return;
    enterWorkspace();
  };

  // The open project appears first, as it is right now, while it has unsaved changes.
  const isSaved = projects.some((p) => p.id === project.id);
  const homeProjects =
    dirty && (isSaved || visitedWorkspace)
      ? [
          { ...project, name: projectName.trim() || 'Untitled project', code: codeInput, circuit, updatedAt: Date.now() },
          ...projects.filter((p) => p.id !== project.id),
        ]
      : projects;

  const deleteFromHome = (p: Project) => {
    if (projects.some((saved) => saved.id === p.id)) {
      deleteProject(p);
      return;
    }
    // Never saved: discarding it just leaves a fresh, hidden project open.
    if (!window.confirm(`Discard "${p.name}"? It was never saved.`)) return;
    openProject(newProject('My first project'), true);
    setDirty(false);
    setVisitedWorkspace(false);
  };

  // Autosave: a moment after the last change. Ctrl+S / Cmd+S still saves straight away.
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(saveProject, 800);
    return () => window.clearTimeout(id);
  }, [dirty, saveProject]);

  const toggleDebugger = (open: boolean) => {
    setDebuggerOpen(open);
    try {
      localStorage.setItem(DEBUGGER_KEY, open ? 'shown' : 'hidden');
    } catch {
      // Not remembering it is fine
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveProject]);

  const activeStep = build && !build.endedAt ? build.steps.find((st) => st.status === 'active') : undefined;
  const programStatus = loading
    ? activeStep
      ? `${activeStep.label}… ${((now - (activeStep.startedAt ?? now)) / 1000).toFixed(0)}s`
      : 'Starting…'
    : commands.length === 0
      ? 'No program loaded'
      : running
        ? 'Running'
        : cycles > 0
          ? 'Stopped'
          : 'Ready';


  return (
    <>
      {view === 'home' && (
        <HomeScreen
          projects={homeProjects}
          unsavedId={dirty ? project.id : null}
          onOpen={openFromHome}
          onNew={() => setNaming(true)}
          onDelete={deleteFromHome}
          onExit={onExit}
          section={homeSection}
          onSection={setHomeSection}
          onTryCode={tryLessonCode}
        />
      )}
      {naming && <NewProjectDialog onCreate={createProject} onCancel={() => setNaming(false)} />}

      {/* The workspace stays mounted behind the home screen, so the editor keeps its undo history */}
      <div className="wb-app app-main" hidden={view === 'home'}>
        <header className="wb-header">
          {/* The logo's menu goes back to all projects or signs out; the hamster sprints while the emulator is busy */}
          <LogoMenu busy={running || loading} onHome={goHome} onSignOut={onExit} />

          <div className="wb-project">
            <input
              className="wb-project-name"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                markDirty();
              }}
              aria-label="Project name"
            />
            <ProjectMenu projects={projects} currentId={project.id} onOpen={openProject} onNew={() => setNaming(true)} onHome={goHome} />
            {/* Projects save themselves a moment after each change */}
            <span className={`wb-save-state${dirty ? ' dirty' : ''}`}>{dirty ? 'Saving…' : 'Saved'}</span>
          </div>

          <nav className="wb-tabs" role="tablist" aria-label="View">
            {(['code', 'design'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>

          <div className="wb-header-actions">
            {/* Build compiles the sketch; Run builds it first if it has changed, then runs it */}
            <button
              type="button"
              className="wb-icon-btn"
              onClick={handleCompileCode}
              disabled={loading || running}
              title="Build"
              aria-label="Build"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <line x1="4.5" y1="19.5" x2="12.5" y2="11.5" className="icon-stroke" />
                <rect x="10" y="6" width="10" height="5.5" rx="1.2" transform="rotate(45 15 8.75)" />
              </svg>
            </button>
            {running ? (
              <button type="button" className="wb-icon-btn stop" onClick={stop} title="Stop" aria-label="Stop">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
                </svg>
              </button>
            ) : (
              <button type="button" className="wb-icon-btn primary" onClick={handleRunClick} disabled={loading} title="Run" aria-label="Run">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l10.5-6.5z" />
                </svg>
              </button>
            )}
            <span className="toolbar-divider" />
            <button
              type="button"
              className={`wb-icon-btn quiet${debuggerOpen ? ' on' : ''}`}
              onClick={() => toggleDebugger(!debuggerOpen)}
              aria-pressed={debuggerOpen}
              title={debuggerOpen ? 'Hide debugger' : 'Show debugger'}
              aria-label={debuggerOpen ? 'Hide debugger' : 'Show debugger'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="5" width="17" height="14" rx="2" className="icon-outline" />
                <rect x="13.5" y="5" width="7" height="14" rx="1" />
              </svg>
            </button>
          </div>
        </header>

        <div className="wb-body">
          <div className="wb-content">
            {/* Code or Design on the left, with the debugger beside either one, so you can watch the chip and
                the circuit at the same time. Both views stay mounted so the editor keeps its undo history and
                the bench its state. */}
            <div className={`wb-stage${debuggerOpen ? '' : ' no-debugger'}`}>
              <section className="code-view" hidden={tab !== 'code'}>
                <div className="code-main">
                  <div className="code-toolbar">
                    <div className="segmented small" role="tablist" aria-label="Source">
                      <button type="button" className={codeSource === 'sketch' ? 'active' : ''} onClick={() => setCodeSource('sketch')}>
                        Sketch
                      </button>
                      <button type="button" className={codeSource === 'hex' ? 'active' : ''} onClick={() => setCodeSource('hex')}>
                        Hex file
                      </button>
                    </div>
                    {codeSource === 'hex' && (
                      <div className="code-toolbar-actions">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".hex" hidden />
                        <button type="button" className="wb-btn" onClick={() => fileInputRef.current?.click()} disabled={running}>
                          Open .hex…
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="code-editor" hidden={codeSource !== 'sketch'}>
                    <Editor
                      language="cpp"
                      theme="vs-dark"
                      value={codeInput}
                      onMount={handleCodeEditorMount}
                      onChange={(value) => {
                        setCodeInput(value ?? '');
                        markDirty();
                      }}
                      options={{
                        automaticLayout: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'Ubuntu Sans Mono', 'Ubuntu Mono', monospace",
                        tabSize: 2,
                        insertSpaces: true,
                        wordWrap: 'on',
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: {
                          other: true,
                          comments: false,
                          strings: false,
                        },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>

                  {codeSource === 'hex' && (
                    <div className="hex-view">
                      {!hexText ? (
                        <div
                          className={`hex-drop${isDraggingOver ? ' over' : ''}`}
                          onDrop={handleDrop}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(true);
                          }}
                          onDragLeave={() => setIsDraggingOver(false)}
                        >
                          {isDraggingOver ? 'Release to load' : (
                            <>
                              Drop a <code>.hex</code> file here, or compile your sketch to see its hex
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="segmented small">
                            {(
                              [
                                ['hex', 'Hex'],
                                ['elf', 'ELF'],
                                ['unknown', `Unknown (${unknownInstructions.length})`],
                                ['errors', `Errors (${errorMessages.length})`],
                              ] as const
                            ).map(([id, label]) => (
                              <button key={id} type="button" className={hexTab === id ? 'active' : ''} onClick={() => setHexTab(id)}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {hexTab === 'hex' && <pre className="hex-pre">{hexText}</pre>}
                          {hexTab === 'elf' && <pre className="hex-pre">{elfText || 'No ELF yet. Compile code to see ELF data.'}</pre>}
                          {hexTab === 'unknown' && (
                            <pre className="hex-pre">
                              {unknownInstructions.length === 0
                                ? 'No unknown instructions found.'
                                : unknownInstructions.map((c) => formatCommandBytes(c.CommandBytes)).join('\n')}
                            </pre>
                          )}
                          {hexTab === 'errors' && <pre className="hex-pre">{errorMessages.join('\n') || 'No errors.'}</pre>}
                        </>
                      )}
                    </div>
                  )}

                </div>
              </section>

              <section className="design-view" hidden={tab !== 'design'}>
                <PartsPalette
                  tool={tool}
                  onToolChange={setTool}
                  ledColor={ledColor}
                  onLedColorChange={setLedColor}
                  wireColor={wireColor}
                  onWireColorChange={setWireColor}
                />
                <Workbench
                  circuit={circuit}
                  onChange={(c) => {
                    setCircuit(c);
                    markDirty();
                  }}
                  tool={tool}
                  onToolChange={setTool}
                  wireColor={wireColor}
                  state={circuitState}
                  pressed={pressed}
                  onPress={(id, down) =>
                    setPressed((prev) => {
                      const next = new Set(prev);
                      if (down) next.add(id);
                      else next.delete(id);
                      return next;
                    })
                  }
                  running={running}
                  onBoardReset={() => resetMachine({ keepRunning: true })}
                />
              </section>

              {debuggerOpen && (
              <Debugger
                onHide={() => toggleDebugger(false)}
                commands={commands}
                position={instructionPosition}
                libraryLine={sketchLine?.inLibrary ? sketchLine.line : null}
                machine={machineData}
                changedRegisters={changedRegisters}
                cycles={cycles}
                onInstructionClick={(i) => {
                  const line = commands[i]?.SourceLineNumber;
                  if (line == null) return;
                  setTab('code');
                  setCodeSource('sketch');
                  highlightSourceLine(line);
                }}
                controls={
                  <>
                    <button type="button" className="wb-btn" onClick={handleStep} disabled={running || commands.length === 0}>
                      Step
                    </button>
                    <button type="button" className="wb-btn" onClick={() => resetMachine()} disabled={commands.length === 0}>
                      Reset
                    </button>
                    <div className="segmented small" aria-label="Speed">
                      {SPEEDS.map((sp, i) => (
                        <button key={sp.label} type="button" className={speed === i ? 'active' : ''} onClick={() => setSpeed(i)}>
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </>
                }
              />
              )}
            </div>

            {outputOpen && (
              <OutputPanel
                lines={outputLog}
                height={outputHeight}
                onResize={setOutputHeight}
                onClear={() => setOutputLog([])}
                onClose={() => showOutput(false)}
              />
            )}
          </div>
        </div>

        <StatusBar
          build={build}
          now={now}
          freshSuccess={freshSuccess}
          idleText={programStatus}
          running={running}
          outputOpen={outputOpen}
          onToggleOutput={() => showOutput(!outputOpen)}
        />
      </div>
    </>
  )
}

export default App
