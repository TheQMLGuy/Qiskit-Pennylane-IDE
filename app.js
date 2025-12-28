/**
 * Quantum IDE - Main Application
 * Qiskit & PennyLane Web-Based Development Environment
 */

// ============================================
// State
// ============================================
let editor;
let pyodide = null;
let isRunning = false;
let currentFramework = 'qiskit';

// Core components
let circuit;
let simulator;
let visualizer;
let blochSphere;
let parser;

// Sync state
let syncDirection = null; // 'code-to-circuit' or 'circuit-to-code'
let isSyncing = false;

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Runtime
    runtimeStatus: document.getElementById('runtimeStatus'),

    // Framework toggle
    qiskitBtn: document.getElementById('qiskitBtn'),
    pennylaneBtn: document.getElementById('pennylaneBtn'),

    // Actions
    runBtn: document.getElementById('runBtn'),
    clearBtn: document.getElementById('clearBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadBtn: document.getElementById('loadBtn'),
    loadInput: document.getElementById('loadInput'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),

    // Editor
    syncIndicator: document.getElementById('syncIndicator'),

    // Circuit
    qubitCount: document.getElementById('qubitCount'),
    circuitSvg: document.getElementById('circuitSvg'),

    // Visualization
    qubitSelect: document.getElementById('qubitSelect'),
    blochCanvas: document.getElementById('blochCanvas'),
    stateFormula: document.getElementById('stateFormula'),
    stateVectorDisplay: document.getElementById('stateVectorDisplay'),
    probabilityBars: document.getElementById('probabilityBars'),

    // Output
    outputArea: document.getElementById('outputArea'),
    clearOutputBtn: document.getElementById('clearOutputBtn'),

    // Parameter Modal
    paramModal: document.getElementById('paramModal'),
    paramModalTitle: document.getElementById('paramModalTitle'),
    paramTheta: document.getElementById('paramTheta'),
    paramThetaSlider: document.getElementById('paramThetaSlider'),
    targetQubitGroup: document.getElementById('targetQubitGroup'),
    targetQubit: document.getElementById('targetQubit'),
    closeParamModal: document.getElementById('closeParamModal'),
    cancelParamBtn: document.getElementById('cancelParamBtn'),
    applyParamBtn: document.getElementById('applyParamBtn'),
    presetBtns: document.querySelectorAll('.preset-btn')
};

// Current gate being configured
let pendingGate = null;

// ============================================
// Initialization
// ============================================
async function init() {
    try {
        // Initialize components
        initEditor();
        initCircuit();
        initVisualizer();
        initBlochSphere();
        initParser();

        // Setup event listeners
        setupEventListeners();
        setupDragAndDrop();

        // Load saved state
        loadSavedState();

        // Initial render
        updateVisualization();

        // Start loading Pyodide in background
        initPyodide();

    } catch (e) {
        console.error('Init error:', e);
        logOutput('Initialization error: ' + e.message, 'error');
    }
}

// ============================================
// Editor
// ============================================
function initEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: 'python',
        theme: 'material-darker',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        styleActiveLine: true,
        extraKeys: {
            'Shift-Enter': () => runCode()
        }
    });

    // Auto-sync on change
    editor.on('change', debounce(() => {
        if (!isSyncing && syncDirection !== 'circuit-to-code') {
            syncCodeToCircuit();
        }
        saveState();
    }, 300));

    // Set initial code
    const defaultCode = getDefaultCode();
    editor.setValue(defaultCode);

    setTimeout(() => {
        editor.refresh();
        editor.focus();
    }, 100);
}

function getDefaultCode() {
    if (currentFramework === 'qiskit') {
        return `from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator

qc = QuantumCircuit(3, 3)

# Create a Bell state
qc.h(0)
qc.cx(0, 1)

# Add a rotation gate
qc.rx(1.5708, 2)

qc.measure_all()

# Simulate
simulator = AerSimulator()
compiled = transpile(qc, simulator)
result = simulator.run(compiled, shots=1024).result()
counts = result.get_counts()
print(counts)`;
    } else {
        return `import pennylane as qml
from pennylane import numpy as np

dev = qml.device("default.qubit", wires=3)

@qml.qnode(dev)
def circuit():
    # Create a Bell state
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    
    # Add a rotation gate
    qml.RX(1.5708, wires=2)
    
    return qml.probs(wires=range(3))

# Run the circuit
probs = circuit()
print("Probabilities:", probs)

# Draw the circuit
print(qml.draw(circuit)())`;
    }
}

// ============================================
// Circuit
// ============================================
function initCircuit() {
    circuit = new QuantumCircuit(3);

    // Listen for changes
    circuit.onChange(() => {
        if (!isSyncing && syncDirection !== 'code-to-circuit') {
            syncCircuitToCode();
        }
        updateVisualization();
    });
}

// ============================================
// Visualizer
// ============================================
function initVisualizer() {
    visualizer = new CircuitVisualizer(elements.circuitSvg, circuit);

    // Gate click handler
    visualizer.onGateClick((gate) => {
        const gateDef = GATES[gate.gate];
        if (gateDef && gateDef.type === 'rotation') {
            openParameterModal(gate);
        }
    });

    // Gate added from drag-drop
    visualizer.onGateAdded((gateType, qubit, position) => {
        addGateInteractive(gateType, qubit, position);
    });

    // Gate removed (right-click)
    visualizer.onGateRemoved((gateId) => {
        circuit.removeGate(gateId);
    });

    visualizer.render();
}

// ============================================
// Bloch Sphere
// ============================================
function initBlochSphere() {
    blochSphere = new BlochSphere(elements.blochCanvas);
}

// ============================================
// Parser
// ============================================
function initParser() {
    parser = new CodeParser();
    parser.setFramework(currentFramework);
}

// ============================================
// Simulator
// ============================================
function initSimulator() {
    simulator = new QuantumSimulator(circuit.numQubits);
}

// ============================================
// Pyodide
// ============================================
async function initPyodide() {
    try {
        updateRuntimeStatus('loading', 'Loading Runtime...');

        pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });

        updateRuntimeStatus('loading', 'Installing packages...');
        logOutput('Installing Python packages...', 'info');

        // Load micropip for package installation
        await pyodide.loadPackage('micropip');

        // Install available scientific packages
        await pyodide.runPythonAsync(`
import micropip

# Install core scientific packages
await micropip.install('numpy')
await micropip.install('scipy')
        `);

        logOutput('Installed: numpy, scipy', 'info');

        updateRuntimeStatus('loading', 'Setting up quantum libraries...');
        logOutput('Setting up quantum simulation libraries...', 'info');

        // Setup Python I/O capture and mock quantum libraries
        await pyodide.runPythonAsync(`
import sys
from io import StringIO
import numpy as np
from collections import Counter
import random

class CaptureOutput:
    def __init__(self):
        self.output = StringIO()

    def write(self, text):
        self.output.write(text)

    def flush(self):
        pass

    def getvalue(self):
        return self.output.getvalue()

    def reset(self):
        self.output = StringIO()

_captured_output = CaptureOutput()
sys.stdout = _captured_output
sys.stderr = _captured_output

# =============================================
# Mock Qiskit Implementation (Browser-compatible)
# =============================================

class QuantumCircuit:
    """Mock Qiskit-style QuantumCircuit for browser simulation"""
    
    def __init__(self, num_qubits, num_classical=None):
        self.num_qubits = num_qubits
        self.num_classical = num_classical if num_classical else num_qubits
        self.gates = []
        self._state = np.zeros(2**num_qubits, dtype=complex)
        self._state[0] = 1.0  # |00...0⟩
        
    def _apply_single_qubit_gate(self, matrix, qubit):
        """Apply a single-qubit gate"""
        n = self.num_qubits
        size = 2**n
        new_state = np.zeros(size, dtype=complex)
        
        for i in range(size):
            bit = (i >> (n - 1 - qubit)) & 1
            for new_bit in range(2):
                new_index = (i & ~(1 << (n - 1 - qubit))) | (new_bit << (n - 1 - qubit))
                new_state[new_index] += matrix[new_bit, bit] * self._state[i]
        
        self._state = new_state
    
    def h(self, qubit):
        """Hadamard gate"""
        self.gates.append(('H', qubit))
        H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
        self._apply_single_qubit_gate(H, qubit)
        
    def x(self, qubit):
        """Pauli-X gate"""
        self.gates.append(('X', qubit))
        X = np.array([[0, 1], [1, 0]], dtype=complex)
        self._apply_single_qubit_gate(X, qubit)
        
    def y(self, qubit):
        """Pauli-Y gate"""
        self.gates.append(('Y', qubit))
        Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
        self._apply_single_qubit_gate(Y, qubit)
        
    def z(self, qubit):
        """Pauli-Z gate"""
        self.gates.append(('Z', qubit))
        Z = np.array([[1, 0], [0, -1]], dtype=complex)
        self._apply_single_qubit_gate(Z, qubit)
        
    def s(self, qubit):
        """S gate"""
        self.gates.append(('S', qubit))
        S = np.array([[1, 0], [0, 1j]], dtype=complex)
        self._apply_single_qubit_gate(S, qubit)
        
    def t(self, qubit):
        """T gate"""
        self.gates.append(('T', qubit))
        T = np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=complex)
        self._apply_single_qubit_gate(T, qubit)
        
    def rx(self, theta, qubit):
        """Rotation around X"""
        self.gates.append(('RX', theta, qubit))
        RX = np.array([
            [np.cos(theta/2), -1j * np.sin(theta/2)],
            [-1j * np.sin(theta/2), np.cos(theta/2)]
        ], dtype=complex)
        self._apply_single_qubit_gate(RX, qubit)
        
    def ry(self, theta, qubit):
        """Rotation around Y"""
        self.gates.append(('RY', theta, qubit))
        RY = np.array([
            [np.cos(theta/2), -np.sin(theta/2)],
            [np.sin(theta/2), np.cos(theta/2)]
        ], dtype=complex)
        self._apply_single_qubit_gate(RY, qubit)
        
    def rz(self, theta, qubit):
        """Rotation around Z"""
        self.gates.append(('RZ', theta, qubit))
        RZ = np.array([
            [np.exp(-1j * theta/2), 0],
            [0, np.exp(1j * theta/2)]
        ], dtype=complex)
        self._apply_single_qubit_gate(RZ, qubit)
        
    def cx(self, control, target):
        """CNOT gate"""
        self.gates.append(('CX', control, target))
        n = self.num_qubits
        size = 2**n
        new_state = self._state.copy()
        
        for i in range(size):
            control_bit = (i >> (n - 1 - control)) & 1
            if control_bit == 1:
                target_bit = (i >> (n - 1 - target)) & 1
                new_target_bit = 1 - target_bit
                new_index = (i & ~(1 << (n - 1 - target))) | (new_target_bit << (n - 1 - target))
                new_state[i], new_state[new_index] = new_state[new_index], new_state[i]
        
        self._state = new_state
        
    def cz(self, control, target):
        """CZ gate"""
        self.gates.append(('CZ', control, target))
        n = self.num_qubits
        size = 2**n
        
        for i in range(size):
            control_bit = (i >> (n - 1 - control)) & 1
            target_bit = (i >> (n - 1 - target)) & 1
            if control_bit == 1 and target_bit == 1:
                self._state[i] *= -1
                
    def swap(self, qubit1, qubit2):
        """SWAP gate"""
        self.gates.append(('SWAP', qubit1, qubit2))
        n = self.num_qubits
        size = 2**n
        new_state = np.zeros(size, dtype=complex)
        
        for i in range(size):
            bit1 = (i >> (n - 1 - qubit1)) & 1
            bit2 = (i >> (n - 1 - qubit2)) & 1
            new_index = i
            new_index = (new_index & ~(1 << (n - 1 - qubit1))) | (bit2 << (n - 1 - qubit1))
            new_index = (new_index & ~(1 << (n - 1 - qubit2))) | (bit1 << (n - 1 - qubit2))
            new_state[new_index] = self._state[i]
        
        self._state = new_state
        
    def measure(self, qubit, classical):
        """Measure a single qubit"""
        self.gates.append(('M', qubit, classical))
        
    def measure_all(self):
        """Add measurement to all qubits"""
        for i in range(self.num_qubits):
            self.gates.append(('M', i, i))
            
    def get_statevector(self):
        """Get the current state vector"""
        return self._state.copy()
    
    def get_probabilities(self):
        """Get measurement probabilities"""
        return np.abs(self._state) ** 2


def transpile(circuit, backend):
    """Mock transpile function"""
    return circuit


class AerSimulator:
    """Mock Aer Simulator"""
    
    def run(self, circuit, shots=1024):
        """Run the circuit and return results"""
        return SimulationResult(circuit, shots)


class SimulationResult:
    """Mock simulation result"""
    
    def __init__(self, circuit, shots):
        self.circuit = circuit
        self.shots = shots
        
    def result(self):
        return self
    
    def get_counts(self):
        """Sample from the probability distribution"""
        probs = self.circuit.get_probabilities()
        n = self.circuit.num_qubits
        
        # Sample shots times
        indices = np.random.choice(len(probs), size=self.shots, p=probs)
        counts = Counter(indices)
        
        # Convert to binary strings
        result = {}
        for idx, count in counts.items():
            binary = format(idx, f'0{n}b')
            result[binary] = count
            
        return dict(sorted(result.items()))


# Create qiskit module namespace
class QiskitModule:
    QuantumCircuit = QuantumCircuit
    transpile = transpile
    
class QiskitAerModule:
    AerSimulator = AerSimulator

# Register as modules
sys.modules['qiskit'] = QiskitModule()
sys.modules['qiskit_aer'] = QiskitAerModule()

# =============================================
# Mock PennyLane Implementation
# =============================================

class PennyLaneDevice:
    """Mock PennyLane device"""
    
    def __init__(self, name, wires):
        self.name = name
        self.wires = wires
        self.num_qubits = wires if isinstance(wires, int) else len(wires)
        self._state = None
        self._ops = []
        
    def reset(self):
        self._state = np.zeros(2**self.num_qubits, dtype=complex)
        self._state[0] = 1.0
        self._ops = []


class PennyLaneOp:
    """Base class for PennyLane operations"""
    
    def __init__(self, wires, params=None):
        self.wires = wires if isinstance(wires, list) else [wires]
        self.params = params or []


class Hadamard(PennyLaneOp):
    name = "Hadamard"
    def __init__(self, wires):
        super().__init__(wires)


class PauliX(PennyLaneOp):
    name = "PauliX"
    def __init__(self, wires):
        super().__init__(wires)


class PauliY(PennyLaneOp):
    name = "PauliY"
    def __init__(self, wires):
        super().__init__(wires)


class PauliZ(PennyLaneOp):
    name = "PauliZ"
    def __init__(self, wires):
        super().__init__(wires)


class S(PennyLaneOp):
    name = "S"
    def __init__(self, wires):
        super().__init__(wires)


class T(PennyLaneOp):
    name = "T"
    def __init__(self, wires):
        super().__init__(wires)


class RX(PennyLaneOp):
    name = "RX"
    def __init__(self, theta, wires):
        super().__init__(wires, [theta])


class RY(PennyLaneOp):
    name = "RY"
    def __init__(self, theta, wires):
        super().__init__(wires, [theta])


class RZ(PennyLaneOp):
    name = "RZ"
    def __init__(self, theta, wires):
        super().__init__(wires, [theta])


class CNOT(PennyLaneOp):
    name = "CNOT"
    def __init__(self, wires):
        super().__init__(wires)


class CZ(PennyLaneOp):
    name = "CZ"
    def __init__(self, wires):
        super().__init__(wires)


class SWAP(PennyLaneOp):
    name = "SWAP"
    def __init__(self, wires):
        super().__init__(wires)


def probs(wires):
    """Return probabilities measurement"""
    return ('probs', wires)


def measure(wires):
    """Return measurement operation"""
    return ('measure', wires)


def device(name, wires):
    """Create a PennyLane device"""
    return PennyLaneDevice(name, wires)


class QNodeWrapper:
    """Wrapper for qnode decorated functions"""
    
    def __init__(self, func, dev):
        self.func = func
        self.dev = dev
        self._ops = []
        
    def __call__(self, *args, **kwargs):
        # Reset device
        self.dev.reset()
        self._ops = []
        
        # Create a mock QuantumCircuit
        qc = QuantumCircuit(self.dev.num_qubits)
        
        # Capture operations by calling the function
        _current_qnode[0] = self
        result = self.func(*args, **kwargs)
        _current_qnode[0] = None
        
        # Apply operations to circuit
        for op in self._ops:
            name = op.name
            wires = op.wires
            params = op.params
            
            if name == "Hadamard":
                qc.h(wires[0])
            elif name == "PauliX":
                qc.x(wires[0])
            elif name == "PauliY":
                qc.y(wires[0])
            elif name == "PauliZ":
                qc.z(wires[0])
            elif name == "S":
                qc.s(wires[0])
            elif name == "T":
                qc.t(wires[0])
            elif name == "RX":
                qc.rx(params[0], wires[0])
            elif name == "RY":
                qc.ry(params[0], wires[0])
            elif name == "RZ":
                qc.rz(params[0], wires[0])
            elif name == "CNOT":
                qc.cx(wires[0], wires[1])
            elif name == "CZ":
                qc.cz(wires[0], wires[1])
            elif name == "SWAP":
                qc.swap(wires[0], wires[1])
        
        # Return probabilities
        return qc.get_probabilities()


# Global to track current qnode being executed
_current_qnode = [None]


def _register_op(op):
    """Register an operation with the current qnode"""
    if _current_qnode[0] is not None:
        _current_qnode[0]._ops.append(op)
    return op


# Override operation __init__ to register
_orig_hadamard_init = Hadamard.__init__
def _new_hadamard_init(self, wires):
    _orig_hadamard_init(self, wires)
    _register_op(self)
Hadamard.__init__ = _new_hadamard_init

_orig_paulix_init = PauliX.__init__
def _new_paulix_init(self, wires):
    _orig_paulix_init(self, wires)
    _register_op(self)
PauliX.__init__ = _new_paulix_init

_orig_pauliy_init = PauliY.__init__
def _new_pauliy_init(self, wires):
    _orig_pauliy_init(self, wires)
    _register_op(self)
PauliY.__init__ = _new_pauliy_init

_orig_pauliz_init = PauliZ.__init__
def _new_pauliz_init(self, wires):
    _orig_pauliz_init(self, wires)
    _register_op(self)
PauliZ.__init__ = _new_pauliz_init

_orig_s_init = S.__init__
def _new_s_init(self, wires):
    _orig_s_init(self, wires)
    _register_op(self)
S.__init__ = _new_s_init

_orig_t_init = T.__init__
def _new_t_init(self, wires):
    _orig_t_init(self, wires)
    _register_op(self)
T.__init__ = _new_t_init

_orig_rx_init = RX.__init__
def _new_rx_init(self, theta, wires):
    _orig_rx_init(self, theta, wires)
    _register_op(self)
RX.__init__ = _new_rx_init

_orig_ry_init = RY.__init__
def _new_ry_init(self, theta, wires):
    _orig_ry_init(self, theta, wires)
    _register_op(self)
RY.__init__ = _new_ry_init

_orig_rz_init = RZ.__init__
def _new_rz_init(self, theta, wires):
    _orig_rz_init(self, theta, wires)
    _register_op(self)
RZ.__init__ = _new_rz_init

_orig_cnot_init = CNOT.__init__
def _new_cnot_init(self, wires):
    _orig_cnot_init(self, wires)
    _register_op(self)
CNOT.__init__ = _new_cnot_init

_orig_cz_init = CZ.__init__
def _new_cz_init(self, wires):
    _orig_cz_init(self, wires)
    _register_op(self)
CZ.__init__ = _new_cz_init

_orig_swap_init = SWAP.__init__
def _new_swap_init(self, wires):
    _orig_swap_init(self, wires)
    _register_op(self)
SWAP.__init__ = _new_swap_init


def qnode(dev):
    """QNode decorator"""
    def decorator(func):
        return QNodeWrapper(func, dev)
    return decorator


def draw(qnode_func):
    """Draw circuit (simplified)"""
    def drawer():
        # Just return a placeholder
        return f"[Quantum Circuit with {qnode_func.dev.num_qubits} qubits]"
    return drawer


# Create pennylane module
class PennyLaneModule:
    device = device
    qnode = qnode
    Hadamard = Hadamard
    PauliX = PauliX
    PauliY = PauliY
    PauliZ = PauliZ
    S = S
    T = T
    RX = RX
    RY = RY
    RZ = RZ
    CNOT = CNOT
    CZ = CZ
    SWAP = SWAP
    probs = probs
    measure = measure
    draw = draw
    numpy = np


sys.modules['pennylane'] = PennyLaneModule()

print("✅ Quantum libraries loaded successfully!")
print("   - qiskit (browser simulation)")
print("   - pennylane (browser simulation)")
print("")
print("Note: This is a browser-based simulation. For full")
print("Qiskit/PennyLane functionality, run in Python locally.")
        `);

        updateRuntimeStatus('ready', 'Runtime Ready');
        logOutput('Quantum libraries loaded successfully! (Browser simulation mode)', 'success');

    } catch (error) {
        updateRuntimeStatus('error', 'Runtime Error');
        console.error('Pyodide error:', error);
        logOutput('Failed to load Python runtime: ' + error.message, 'error');
    }
}

function updateRuntimeStatus(state, text) {
    if (!elements.runtimeStatus) return;
    elements.runtimeStatus.className = `runtime-status ${state}`;
    elements.runtimeStatus.querySelector('.status-text').textContent = text;
}

// ============================================
// Synchronization
// ============================================
function syncCodeToCircuit() {
    if (isSyncing) return;

    isSyncing = true;
    syncDirection = 'code-to-circuit';
    showSyncIndicator();

    try {
        const code = editor.getValue();
        const parsed = parser.parseCode(code);

        // Update circuit
        circuit.numQubits = parsed.numQubits;
        circuit.gates = parsed.gates.map(g => ({
            ...g,
            id: Date.now() + Math.random()
        }));

        // Update qubit count input
        elements.qubitCount.value = parsed.numQubits;
        updateQubitSelect();

        // Re-render visualizer
        visualizer.render();

        // Update simulation
        updateVisualization();

    } catch (e) {
        console.error('Parse error:', e);
    }

    setTimeout(() => {
        isSyncing = false;
        syncDirection = null;
        hideSyncIndicator();
    }, 100);
}

function syncCircuitToCode() {
    if (isSyncing) return;

    isSyncing = true;
    syncDirection = 'circuit-to-code';
    showSyncIndicator();

    try {
        const code = parser.generateCode(circuit);
        editor.setValue(code);
    } catch (e) {
        console.error('Code generation error:', e);
    }

    setTimeout(() => {
        isSyncing = false;
        syncDirection = null;
        hideSyncIndicator();
    }, 100);
}

function showSyncIndicator() {
    elements.syncIndicator.classList.add('syncing');
}

function hideSyncIndicator() {
    elements.syncIndicator.classList.remove('syncing');
}

// ============================================
// Visualization Updates
// ============================================
function updateVisualization() {
    // Initialize/update simulator
    if (!simulator || simulator.numQubits !== circuit.numQubits) {
        simulator = new QuantumSimulator(circuit.numQubits);
    }

    // Simulate circuit
    const result = simulator.simulateCircuit(circuit);

    // Update state vector display
    updateStateVectorDisplay(result.stateVector);

    // Update probability bars
    updateProbabilityBars(result.probabilities);

    // Update Bloch sphere for selected qubit
    updateBlochSphere();

    // Re-render circuit
    visualizer.render();
}

function updateStateVectorDisplay(stateVector) {
    const container = elements.stateVectorDisplay;
    container.innerHTML = '';

    const numQubits = circuit.numQubits;

    for (let i = 0; i < stateVector.length; i++) {
        const amp = stateVector[i];
        const prob = Complex.magnitude(amp) ** 2;

        if (prob > 0.0001) { // Only show non-negligible
            const basis = i.toString(2).padStart(numQubits, '0');

            const item = document.createElement('div');
            item.className = 'state-item';
            item.innerHTML = `
                <span class="state-basis">|${basis}⟩</span>
                <span class="state-amplitude">${Complex.toString(amp)}</span>
            `;
            container.appendChild(item);
        }
    }

    if (container.children.length === 0) {
        container.innerHTML = '<div class="state-item"><span class="state-basis">|0...0⟩</span><span class="state-amplitude">1.000</span></div>';
    }
}

function updateProbabilityBars(probabilities) {
    const container = elements.probabilityBars;
    container.innerHTML = '';

    const numQubits = circuit.numQubits;

    // Sort by probability (descending)
    const sorted = probabilities.map((p, i) => ({ index: i, prob: p }))
        .filter(x => x.prob > 0.001)
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 8); // Top 8

    for (const { index, prob } of sorted) {
        const basis = index.toString(2).padStart(numQubits, '0');
        const percent = (prob * 100).toFixed(1);

        const item = document.createElement('div');
        item.className = 'prob-item';
        item.innerHTML = `
            <span class="prob-label">|${basis}⟩</span>
            <div class="prob-bar-container">
                <div class="prob-bar" style="width: ${percent}%"></div>
            </div>
            <span class="prob-value">${percent}%</span>
        `;
        container.appendChild(item);
    }
}

function updateBlochSphere() {
    const qubitIndex = parseInt(elements.qubitSelect.value) || 0;

    if (qubitIndex >= circuit.numQubits) {
        elements.qubitSelect.value = 0;
        return updateBlochSphere();
    }

    const qubitState = simulator.getQubitState(qubitIndex);
    blochSphere.setStateFromQubit(qubitState);

    // Update state formula
    const stateStr = blochSphere.getStateString();
    elements.stateFormula.textContent = stateStr;
}

function updateQubitSelect() {
    const select = elements.qubitSelect;
    const currentValue = parseInt(select.value) || 0;

    select.innerHTML = '';

    for (let i = 0; i < circuit.numQubits; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Qubit ${i}`;
        select.appendChild(option);
    }

    select.value = Math.min(currentValue, circuit.numQubits - 1);
}

// ============================================
// Gate Interaction
// ============================================
function addGateInteractive(gateType, qubit, position) {
    const gateDef = GATES[gateType];
    if (!gateDef) return;

    if (gateDef.type === 'rotation') {
        // Show parameter modal
        pendingGate = {
            type: 'add',
            gate: gateType,
            qubit,
            position
        };
        openParameterModal(null, gateType, qubit);
    } else if (gateDef.type === 'controlled' || gateDef.type === 'swap') {
        // Show target qubit selector
        pendingGate = {
            type: 'add',
            gate: gateType,
            qubit,
            position
        };
        openParameterModal(null, gateType, qubit, true);
    } else {
        // Add directly
        circuit.addGate(gateType, qubit, { position });
    }
}

function openParameterModal(existingGate, gateType, qubit, showTargetQubit = false) {
    const modal = elements.paramModal;

    if (existingGate) {
        elements.paramModalTitle.textContent = `Edit ${GATES[existingGate.gate].name}`;
        elements.paramTheta.value = existingGate.params.theta || 0;
        elements.paramThetaSlider.value = existingGate.params.theta || 0;
        pendingGate = { type: 'edit', gateId: existingGate.id };
    } else {
        elements.paramModalTitle.textContent = `Add ${GATES[gateType].name}`;
        elements.paramTheta.value = 0;
        elements.paramThetaSlider.value = 0;
    }

    // Show/hide target qubit selector
    if (showTargetQubit) {
        elements.targetQubitGroup.classList.remove('hidden');
        const targetSelect = elements.targetQubit;
        targetSelect.innerHTML = '';

        for (let i = 0; i < circuit.numQubits; i++) {
            if (i !== qubit) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Qubit ${i}`;
                targetSelect.appendChild(option);
            }
        }
    } else {
        elements.targetQubitGroup.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

function closeParameterModal() {
    elements.paramModal.classList.add('hidden');
    pendingGate = null;
}

function applyParameterModal() {
    if (!pendingGate) return;

    const theta = parseFloat(elements.paramTheta.value) || 0;
    const targetQubit = parseInt(elements.targetQubit.value);

    if (pendingGate.type === 'add') {
        const options = {
            position: pendingGate.position,
            params: { theta }
        };

        if (!elements.targetQubitGroup.classList.contains('hidden')) {
            options.targetQubit = targetQubit;
        }

        circuit.addGate(pendingGate.gate, pendingGate.qubit, options);
    } else if (pendingGate.type === 'edit') {
        circuit.updateGate(pendingGate.gateId, {
            params: { theta }
        });
    }

    closeParameterModal();
}

// ============================================
// Code Execution
// ============================================
async function runCode() {
    if (!pyodide) {
        logOutput('Python runtime not ready yet. Please wait...', 'error');
        return;
    }

    if (isRunning) return;
    isRunning = true;

    updateRuntimeStatus('running', 'Running...');
    logOutput('Running code...', 'info');

    try {
        // Reset output
        await pyodide.runPythonAsync('_captured_output.reset()');

        const code = editor.getValue();
        await pyodide.runPythonAsync(code);

        // Get output
        const output = await pyodide.runPythonAsync('_captured_output.getvalue()');

        if (output) {
            logOutput(output);
        } else {
            logOutput('Code executed successfully (no output)', 'success');
        }

    } catch (error) {
        logOutput('Error: ' + error.message, 'error');
    }

    isRunning = false;
    updateRuntimeStatus('ready', 'Runtime Ready');
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Framework toggle
    elements.qiskitBtn.addEventListener('click', () => switchFramework('qiskit'));
    elements.pennylaneBtn.addEventListener('click', () => switchFramework('pennylane'));

    // Actions
    elements.runBtn.addEventListener('click', runCode);
    elements.clearBtn.addEventListener('click', clearCircuit);
    elements.saveBtn.addEventListener('click', saveToFile);
    elements.loadBtn.addEventListener('click', () => elements.loadInput.click());
    elements.loadInput.addEventListener('change', loadFromFile);
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Qubit count
    elements.qubitCount.addEventListener('change', (e) => {
        const n = parseInt(e.target.value) || 3;
        circuit.setNumQubits(Math.max(1, Math.min(10, n)));
        updateQubitSelect();
        visualizer.render();
        updateVisualization();
    });

    // Qubit select for Bloch sphere
    elements.qubitSelect.addEventListener('change', updateBlochSphere);

    // Output
    elements.clearOutputBtn.addEventListener('click', () => {
        elements.outputArea.innerHTML = '';
    });

    // Parameter modal
    elements.closeParamModal.addEventListener('click', closeParameterModal);
    elements.cancelParamBtn.addEventListener('click', closeParameterModal);
    elements.applyParamBtn.addEventListener('click', applyParameterModal);

    // Slider sync
    elements.paramThetaSlider.addEventListener('input', (e) => {
        elements.paramTheta.value = parseFloat(e.target.value).toFixed(4);
    });
    elements.paramTheta.addEventListener('input', (e) => {
        elements.paramThetaSlider.value = parseFloat(e.target.value) || 0;
    });

    // Preset buttons
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseFloat(btn.dataset.value);
            elements.paramTheta.value = value.toFixed(4);
            elements.paramThetaSlider.value = value;
        });
    });

    // Modal escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeParameterModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
    });
}

function setupDragAndDrop() {
    // Make gate buttons draggable
    const gateButtons = document.querySelectorAll('.gate-btn');

    gateButtons.forEach(btn => {
        btn.draggable = true;

        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('gate', btn.dataset.gate);
            e.dataTransfer.effectAllowed = 'copy';
            btn.classList.add('dragging');
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
        });

        // Also handle click to add at next available position
        btn.addEventListener('click', () => {
            const gateType = btn.dataset.gate;
            const gateDef = GATES[gateType];

            // Add to qubit 0 at next position
            if (gateDef.type === 'rotation') {
                pendingGate = {
                    type: 'add',
                    gate: gateType,
                    qubit: 0,
                    position: circuit.getDepth()
                };
                openParameterModal(null, gateType, 0);
            } else if (gateDef.type === 'controlled' || gateDef.type === 'swap') {
                pendingGate = {
                    type: 'add',
                    gate: gateType,
                    qubit: 0,
                    position: circuit.getDepth()
                };
                openParameterModal(null, gateType, 0, true);
            } else {
                circuit.addGate(gateType, 0);
            }
        });
    });
}

// ============================================
// Actions
// ============================================
function switchFramework(framework) {
    currentFramework = framework;
    parser.setFramework(framework);

    // Update UI
    elements.qiskitBtn.classList.toggle('active', framework === 'qiskit');
    elements.pennylaneBtn.classList.toggle('active', framework === 'pennylane');

    // Regenerate code
    syncCircuitToCode();
}

function clearCircuit() {
    circuit.clear();
    elements.qubitCount.value = 3;
    circuit.setNumQubits(3);
    updateQubitSelect();
}

function toggleTheme() {
    const isDark = !document.body.hasAttribute('data-theme');

    if (isDark) {
        document.body.setAttribute('data-theme', 'light');
        elements.themeIcon.textContent = '☀️';
    } else {
        document.body.removeAttribute('data-theme');
        elements.themeIcon.textContent = '🌙';
    }

    saveState();
}

// ============================================
// Persistence
// ============================================
function saveState() {
    try {
        const state = {
            framework: currentFramework,
            circuit: circuit.toJSON(),
            code: editor.getValue(),
            theme: document.body.hasAttribute('data-theme') ? 'light' : 'dark'
        };
        localStorage.setItem('quantumIDE_state', JSON.stringify(state));
    } catch (e) {
        console.error('Save error:', e);
    }
}

function loadSavedState() {
    try {
        const saved = localStorage.getItem('quantumIDE_state');
        if (saved) {
            const state = JSON.parse(saved);

            // Restore framework
            if (state.framework) {
                switchFramework(state.framework);
            }

            // Restore circuit
            if (state.circuit) {
                circuit.fromJSON(state.circuit);
                elements.qubitCount.value = circuit.numQubits;
                updateQubitSelect();
            }

            // Restore code
            if (state.code) {
                editor.setValue(state.code);
            }

            // Restore theme
            if (state.theme === 'light') {
                document.body.setAttribute('data-theme', 'light');
                elements.themeIcon.textContent = '☀️';
            }
        }
    } catch (e) {
        console.error('Load error:', e);
    }
}

function saveToFile() {
    const state = {
        framework: currentFramework,
        circuit: circuit.toJSON(),
        code: editor.getValue(),
        timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `quantum_circuit_${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    logOutput('Circuit saved!', 'success');
}

function loadFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const state = JSON.parse(event.target.result);

            if (state.framework) {
                switchFramework(state.framework);
            }

            if (state.circuit) {
                circuit.fromJSON(state.circuit);
                elements.qubitCount.value = circuit.numQubits;
                updateQubitSelect();
            }

            if (state.code) {
                editor.setValue(state.code);
            }

            updateVisualization();
            logOutput('Circuit loaded!', 'success');

        } catch (error) {
            logOutput('Failed to load file: ' + error.message, 'error');
        }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
}

// ============================================
// Utilities
// ============================================
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

function logOutput(message, type = '') {
    const output = elements.outputArea;
    const line = document.createElement('div');
    line.className = type;
    line.textContent = message;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

// ============================================
// Start
// ============================================
document.addEventListener('DOMContentLoaded', init);
