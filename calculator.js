class Engine {
    constructor() {
        this.operators = {
            '+': { precedence: 2, associativity: 'Left' },
            '-': { precedence: 2, associativity: 'Left' },
            '*': { precedence: 3, associativity: 'Left' },
            '/': { precedence: 3, associativity: 'Left' },
            '^': { precedence: 4, associativity: 'Right' },
            '%': { precedence: 3, associativity: 'Left' }
        };
    }

    tokenize(expression) {
        const tokens = [];
        let numberBuffer = '';
        let funcBuffer = '';

        for (let i = 0; i < expression.length; i++) {
            const char = expression[i];

            if (/\d|\./.test(char)) {
                numberBuffer += char;
            } else if (/[a-z]/.test(char)) {
                funcBuffer += char;
            } else {
                if (numberBuffer) {
                    tokens.push(this.processNumber(numberBuffer));
                    numberBuffer = '';
                }
                if (funcBuffer) {
                    tokens.push({ type: 'FUNCTION', value: funcBuffer });
                    funcBuffer = '';
                }

                if (/\s/.test(char)) continue;

                if (this.operators[char] || char === '(' || char === ')') {
                    tokens.push({ type: 'OPERATOR', value: char });
                } else {
                    throw new Error(`Unknown character: ${char}`);
                }
            }
        }

        if (numberBuffer) tokens.push(this.processNumber(numberBuffer));
        if (funcBuffer) tokens.push({ type: 'FUNCTION', value: funcBuffer });

        return tokens;
    }

    processNumber(str) {
        const val = parseFloat(str);
        if (isNaN(val)) throw new Error('Invalid number');
        return { type: 'NUMBER', value: val };
    }

    shuntingYard(tokens) {
        const outputQueue = [];
        const operatorStack = [];

        tokens.forEach(token => {
            if (token.type === 'NUMBER') {
                outputQueue.push(token);
            } else if (token.type === 'FUNCTION') {
                operatorStack.push(token);
            } else if (token.value === '(') {
                operatorStack.push(token);
            } else if (token.value === ')') {
                while (operatorStack.length && operatorStack[operatorStack.length - 1].value !== '(') {
                    outputQueue.push(operatorStack.pop());
                }
                if (!operatorStack.length) throw new Error('Mismatched parentheses');
                operatorStack.pop(); // Pop '('
                if (operatorStack.length && operatorStack[operatorStack.length - 1].type === 'FUNCTION') {
                    outputQueue.push(operatorStack.pop());
                }
            } else {
                const o1 = token;
                while (operatorStack.length) {
                    const o2 = operatorStack[operatorStack.length - 1];
                    if (o2.value === '(') break;

                    const p1 = this.operators[o1.value].precedence;
                    const p2 = this.operators[o2.value]?.precedence || 0;

                    if ((this.operators[o1.value].associativity === 'Left' && p1 <= p2) ||
                        (this.operators[o1.value].associativity === 'Right' && p1 < p2)) {
                        outputQueue.push(operatorStack.pop());
                    } else {
                        break;
                    }
                }
                operatorStack.push(o1);
            }
        });

        while (operatorStack.length) {
            const op = operatorStack.pop();
            if (op.value === '(') throw new Error('Mismatched parentheses');
            outputQueue.push(op);
        }

        return outputQueue;
    }

    evaluate(rpn, isDegree = true) {
        const stack = [];

        rpn.forEach(token => {
            if (token.type === 'NUMBER') {
                stack.push(token.value);
            } else if (token.type === 'OPERATOR') {
                const b = stack.pop();
                const a = stack.pop();
                switch (token.value) {
                    case '+': stack.push(a + b); break;
                    case '-': stack.push(a - b); break;
                    case '*': stack.push(a * b); break;
                    case '/':
                        if (b === 0) throw new Error('Div by 0');
                        stack.push(a / b);
                        break;
                    case '^': stack.push(Math.pow(a, b)); break;
                    case '%': stack.push(a % b); break;
                    default: throw new Error('Unknown operator');
                }
            } else if (token.type === 'FUNCTION') {
                const a = stack.pop();
                const res = this.applyFunction(token.value, a, isDegree);
                stack.push(res);
            }
        });

        return stack[0];
    }

    applyFunction(name, val, isDegree = true) {
        switch (name) {
            case 'sin': return isDegree ? Math.sin(val * Math.PI / 180) : Math.sin(val);
            case 'cos': return isDegree ? Math.cos(val * Math.PI / 180) : Math.cos(val);
            case 'tan': return isDegree ? Math.tan(val * Math.PI / 180) : Math.tan(val);
            case 'log': return Math.log10(val);
            case 'ln': return Math.log(val);
            case 'sqrt': return Math.sqrt(val);
            case 'fact': return this.factorial(val);
            default: throw new Error(`Unsupported function: ${name}`);
        }
    }

    factorial(n) {
        if (n < 0) throw new Error('Factorial of negative');
        if (n % 1 !== 0) throw new Error('Factorial of non-integer');
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }
}

class Memory {
    constructor() {
        this.value = 0;
    }
    clear() { this.value = 0; }
    recall() { return this.value; }
    add(val) { this.value += val; }
    subtract(val) { this.value -= val; }
}

class History {
    constructor() {
        this.log = JSON.parse(localStorage.getItem('calc_history') || '[]');
    }
    add(expression, result) {
        this.log.unshift({ expression, result, timestamp: new Date().toLocaleTimeString() });
        if (this.log.length > 50) this.log.pop();
        this.save();
    }
    clear() {
        this.log = [];
        this.save();
    }
    save() {
        localStorage.setItem('calc_history', JSON.stringify(this.log));
    }
    getEntries() {
        return this.log;
    }
}

class UIController {
    constructor() {
        this.engine = new Engine();
        this.memory = new Memory();
        this.history = new History();

        this.currentExpression = '';
        this.isDegree = true;
        this.isDarkMode = true;

        this.initElements();
        this.initEventListeners();
        this.updateHistoryUI();
    }

    initElements() {
        this.exprDisplay = document.getElementById('expressionDisplay');
        this.resDisplay = document.getElementById('resultDisplay');
        this.historySidebar = document.getElementById('historySidebar');
        this.historyList = document.getElementById('historyList');
        this.degRadBtn = document.getElementById('degRadToggle');
        this.themeBtn = document.getElementById('themeToggle');
    }

    initEventListeners() {
        // Button clicks
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleButtonClick(btn));
        });

        document.getElementById('equalBtn').addEventListener('click', () => this.calculate());

        // Controls
        document.getElementById('toggleHistory').addEventListener('click', () => {
            this.historySidebar.classList.toggle('open');
        });

        document.getElementById('closeHistory').addEventListener('click', () => {
            this.historySidebar.classList.remove('open');
        });

        document.getElementById('clearHistory').addEventListener('click', () => {
            this.history.clear();
            this.updateHistoryUI();
        });

        this.degRadBtn.addEventListener('click', () => {
            this.isDegree = !this.isDegree;
            this.degRadBtn.textContent = this.isDegree ? 'DEG' : 'RAD';
        });

        this.themeBtn.addEventListener('click', () => {
            this.isDarkMode = !this.isDarkMode;
            document.body.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
            this.themeBtn.textContent = this.isDarkMode ? '🌙' : '☀️';
        });

        // Keyboard support
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    handleButtonClick(btn) {
        const val = btn.dataset.val;
        const op = btn.dataset.op;
        const func = btn.dataset.func;
        const constVal = btn.dataset.const;
        const action = btn.dataset.action;

        if (val) this.appendInput(val);
        else if (op) this.appendInput(op);
        else if (func) this.appendInput(func + '(');
        else if (constVal) this.appendConstant(constVal);
        else if (action) this.handleAction(action);
    }

    appendInput(char) {
        this.currentExpression += char;
        this.updateDisplay();
    }

    appendConstant(c) {
        const val = c === 'PI' ? 'π' : 'e';
        const actualVal = c === 'PI' ? Math.PI : Math.E;
        // To make the engine handle π and e, we need to tweak tokenization or just insert the value.
        // For now, let's insert the numeric value for simplicity in the expression display.
        this.currentExpression += actualVal.toFixed(8);
        this.updateDisplay();
    }

    handleAction(action) {
        switch (action) {
            case 'clear':
                this.currentExpression = '';
                this.resDisplay.textContent = '0';
                break;
            case 'backspace':
                this.currentExpression = this.currentExpression.slice(0, -1);
                break;
            case 'MC':
                this.memory.clear();
                break;
            case 'MR':
                this.appendInput(this.memory.recall().toString());
                break;
            case 'M+':
                const currentVal = parseFloat(this.resDisplay.textContent) || 0;
                this.memory.add(currentVal);
                break;
            case 'M-':
                const currentValSub = parseFloat(this.resDisplay.textContent) || 0;
                this.memory.subtract(currentValSub);
                break;
        }
        this.updateDisplay();
    }

    handleKeyPress(e) {
        const key = e.key;
        if (/\d|\.|\+|\-|\*|\/|\(|\)/.test(key)) {
            this.appendInput(key);
        } else if (key === 'Enter') {
            this.calculate();
        } else if (key === 'Backspace') {
            this.handleAction('backspace');
        } else if (key === 'Escape') {
            this.handleAction('clear');
        }
    }

    updateDisplay() {
        this.exprDisplay.textContent = this.currentExpression;
    }

    calculate() {
        try {
            const tokens = this.engine.tokenize(this.currentExpression);
            const rpn = this.engine.shuntingYard(tokens);
            const result = this.engine.evaluate(rpn, this.isDegree);

            const formattedResult = Number.isInteger(result) ? result : result.toFixed(8).replace(/\.?0+$/, '');

            this.resDisplay.textContent = formattedResult;
            this.history.add(this.currentExpression, formattedResult);
            this.updateHistoryUI();

            // Allow result to be used in next calculation
            this.currentExpression = formattedResult.toString();
        } catch (e) {
            this.resDisplay.textContent = 'Error';
            console.error(e);
        }
    }

    updateHistoryUI() {
        this.historyList.innerHTML = '';
        this.history.getEntries().forEach(entry => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<span class="expr">${entry.expression}</span><span class="res">${entry.result}</span>`;
            div.onclick = () => {
                this.currentExpression = entry.expression;
                this.updateDisplay();
                this.calculate();
            };
            this.historyList.appendChild(div);
        });
    }
}

new UIController();
