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
import { ProjectsSidebar } from './ProjectsSidebar'
import { HamsterWheel } from './HamsterWheel'
import { HomeScreen, type HomeSection } from './HomeScreen'
import { Learn } from './Learn'
import { BuildProgress, type BuildState } from './BuildProgress'
import { WIRE_COLORS, evaluateCircuit, type Circuit, type LedColor } from './circuit'
import { loadProjects, newProject, storeProjects, type Project } from './projects'

function ConvertHexToNumber(hexDigits: string): number { return parseInt(hexDigits, 16); }

const pastelPalette = [
  '#ffdfe5',
  '#ffeecf',
  '#e4f6d9',
  '#d9f3f4',
  '#dde8ff',
  '#eadfff',
  '#ffdff4',
  '#f6e7d9',
];

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

// Run speeds: one instruction at a time (watch the debugger), slowed-down time, or real time.
const SPEEDS = [
  { label: 'Instruction', kind: 'step', delay: 250 },
  { label: '1/20×', kind: 'time', factor: 0.05 },
  { label: 'Real time', kind: 'time', factor: 1 },
] as const;

// How often the run loop asks the backend for the next slice of emulated time.
const FRAME_MS = 33;

type Tab = 'code' | 'design' | 'learn';

const TAB_LABELS: Record<Tab, string> = { code: 'Code', design: 'Design', learn: 'Learn' };

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

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Progress of the current compile or load, shown step by step.
  const [build, setBuild] = useState<BuildState | null>(null);
  const [now, setNow] = useState(() => performance.now());
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

  const highlightSourceLine = (lineNumber: number, colorIndex: number) => {
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
          className: `source-line-highlight-${colorIndex}`,
          linesDecorationsClassName: `source-line-highlight-gutter-${colorIndex}`,
        },
      }]);

    monacoEditorRef.current.revealLineInCenter(lineNumber);
  };

  // Show which source line the current instruction came from. Skipped while running at speed, where it
  // would jump around the editor many times a second.
  useEffect(() => {
    if (running && SPEEDS[speed].kind === 'time') return;
    const line = commands[instructionPosition]?.SourceLineNumber;
    if (line != null) highlightSourceLine(line, line % pastelPalette.length);
  }, [commands, instructionPosition, running, speed]);

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
    setChangedRegisters(changed);
    setCycles(state.cycles);
    if (state.error) {
      stop();
      setErrorMessages([`The program stopped: ${state.error}`]);
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
    clearHighlightedSourceLine();
    if (commandsRef.current.length === 0) return;
    try {
      applyState(await resetEmulator());
      setErrorMessages([]);
    } catch (e) {
      setErrorMessages([errorText(e, 'Failed to reset the emulator')]);
    }
  };

  const loadProgram = async (instructions: CommandInformation[], lines: string[]) => {
    stop();
    clearHighlightedSourceLine();
    commandsRef.current = instructions;
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
      setErrorMessages([errorText(e, 'Failed to run instruction')]);
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
      setErrorMessages([errorText(e, 'Failed to run the program')]);
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
      setErrorMessages(['No instruction data records found in HEX file.']);
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

  const startBuild = (title: string, steps: { id: string; label: string }[]) =>
    setBuild({ title, startedAt: performance.now(), steps: steps.map((st) => ({ ...st, status: 'pending' as const })) });

  // Finish the step in progress and start the next one.
  const enterStep = (id: string, detail?: string) =>
    setBuild((b) => {
      if (!b) return b;
      const t = performance.now();
      return {
        ...b,
        steps: b.steps.map((st) =>
          st.id === id
            ? { ...st, status: 'active', startedAt: t, detail }
            : st.status === 'active'
              ? { ...st, status: 'done', endedAt: t }
              : st,
        ),
      };
    });

  const stepDetail = (detail: string) =>
    setBuild((b) => b && { ...b, steps: b.steps.map((st) => (st.status === 'active' ? { ...st, detail } : st)) });

  const endBuild = (ok: boolean) =>
    setBuild((b) => {
      if (!b) return b;
      const t = performance.now();
      return {
        ...b,
        endedAt: t,
        failed: !ok,
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

  // Tick the elapsed times while something is in progress.
  useEffect(() => {
    if (!build || build.endedAt) return;
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, [build]);

  // A successful build's summary goes away on its own; a failed one stays until dismissed.
  useEffect(() => {
    if (!build?.endedAt || build.failed) return;
    const id = setTimeout(() => setBuild((b) => (b === build ? null : b)), 4000);
    return () => clearTimeout(id);
  }, [build]);

  const convertToInstructions = async (lines = dataLines) => {
    try {
      setLoading(true);
      setErrorMessages([]);

      if (lines.length === 0) {
        throw new Error('No HEX instruction data available. Upload or compile code first.');
      }

      startBuild('Loading hex file', HEX_STEPS);
      enterStep('decode', `Decoding ${lines.length} lines of hex data`);
      const instructions = await findAllInstructions(lines);
      enterStep('load', `Loading ${instructions.length} instructions into the emulator`);
      await loadProgram(instructions, lines);
      setCompiledFrom('hex');
      endBuild(true);
    } catch (e) {
      endBuild(false);
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
      startBuild('Compiling', COMPILE_STEPS);
      const result = await compileCodeStream(codeInput, (progress) => {
        if (progress.type === 'stage') enterStep(progress.stage, progress.message);
        else stepDetail(progress.message);
      });

      if (result.errors.length > 0 || !result.hexText) {
        endBuild(false);
        setElfText("");
        setErrorMessages(result.errors.length > 0 ? result.errors : ['Failed to compile code']);
        return false;
      }

      setHexText(result.hexText);
      setElfText(result.elfBase64 ? ConvertElfBase64ToHexDump(result.elfBase64) : 'No compiled ELF payload returned.');

      const lines = ParseHexDataLines(result.hexText);
      setDataLines(lines);
      if (lines.length === 0) {
        endBuild(false);
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
      endBuild(false);
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
    // Only one Learn open at a time, so lesson progress isn't kept in two places
    if (tab === 'learn') setTab('code');
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

  const errorsPanel = errorMessages.length > 0 && (
    <div className="code-errors" role="log" aria-live="polite">
      <div className="code-errors-title">Errors</div>
      <ul>
        {errorMessages.map((message, index) => (
          <li key={index}>{message}</li>
        ))}
      </ul>
    </div>
  );

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
          {/* The hamster sprints whenever the emulator is busy. Clicking the logo goes back home. */}
          <button type="button" className="wb-brand wb-home" onClick={goHome} title="Home: all projects">
            <HamsterWheel running={running || loading} className="wb-hamster" />
            <span>
              <span className="brand-ohm">Ohm</span>ster
            </span>
          </button>

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
            <span className={`wb-save-state${dirty ? ' dirty' : ''}`}>{dirty ? 'Unsaved' : 'Saved'}</span>
          </div>

          <nav className="wb-tabs" role="tablist" aria-label="View">
            {(['code', 'design', 'learn'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>

          <div className="wb-header-actions">
            <span className={`wb-status ${loading ? 'wb-status-busy' : `wb-status-${programStatus.toLowerCase().replace(/[^a-z]/g, '')}`}`}>
              {loading && <span className="wb-spinner" aria-hidden="true" />}
              {programStatus}
            </span>
            {running ? (
              <button type="button" className="wb-btn stop" onClick={stop}>
                ■ Stop
              </button>
            ) : (
              <button type="button" className="wb-btn primary" onClick={handleRunClick} disabled={loading}>
                Run ▶
              </button>
            )}
            <button type="button" className="wb-btn" onClick={saveProject} title="Save (Ctrl+S / Cmd+S)">
              Save
            </button>
            <button type="button" className="wb-btn ghost" onClick={onExit}>
              Exit
            </button>
          </div>
        </header>

        <div className="wb-body">
          {tab !== 'learn' && (
            <ProjectsSidebar
              projects={projects}
              currentId={project.id}
              currentName={projectName}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((c) => !c)}
              onOpen={openProject}
              onNew={() => setNaming(true)}
              onDelete={deleteProject}
            />
          )}

          <div className="wb-content">
            {build && <BuildProgress build={build} now={now} onDismiss={() => setBuild(null)} />}

            {/* Code and Design stay mounted so the editor keeps its undo history and the bench its state */}
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
                  <div className="code-toolbar-actions">
                    {codeSource === 'sketch' ? (
                      <button type="button" className="wb-btn" onClick={handleCompileCode} disabled={loading || running}>
                        Compile
                      </button>
                    ) : (
                      <>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".hex" hidden />
                        <button type="button" className="wb-btn" onClick={() => fileInputRef.current?.click()} disabled={running}>
                          Open .hex…
                        </button>
                      </>
                    )}
                    <span className="toolbar-divider" />
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
                  </div>
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

                {errorsPanel}
              </div>

              <Debugger
                commands={commands}
                position={instructionPosition}
                machine={machineData}
                changedRegisters={changedRegisters}
                cycles={cycles}
                onInstructionClick={(i) => {
                  const line = commands[i]?.SourceLineNumber;
                  if (line == null) return;
                  setCodeSource('sketch');
                  highlightSourceLine(line, line % pastelPalette.length);
                }}
              />
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

            {tab === 'learn' && <Learn onTryCode={tryLessonCode} />}
          </div>
        </div>
      </div>
    </>
  )
}

export default App
