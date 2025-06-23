import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    const opponents = ns.args || ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];

    class EnhancedBitburnerGoAI {
        constructor(ns) {
            this.ns = ns;
            this.boardSize = 13;
            this.state = {
                board: [],
                currentPlayer: null,
                gameOver: false,
                winner: -1,
                moveCount: 0,
                ourColor: null,
                opponentColor: null,
            };
            this.patterns = this.initializePatterns();
            this.initializeGame();
        }

        initializeGame() {
            const boardState = this.ns.go.getBoardState();
            this.state.board = boardState.map((row) => [...row]);
            this.determineColors();
            this.state.currentPlayer = this.state.ourColor === "X" ? 1 : 2;
            this.state.gameOver = false;
            this.state.winner = -1;
            this.state.moveCount = this.countStones();
        }

        determineColors() {
            let xCount = 0,
                oCount = 0;
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (this.state.board[y][x] === "X") xCount++;
                    else if (this.state.board[y][x] === "O") oCount++;
                }
            }

            if (xCount === oCount) {
                this.state.ourColor = "X";
                this.state.opponentColor = "O";
            } else if (xCount > oCount) {
                this.state.ourColor = "O";
                this.state.opponentColor = "X";
            } else {
                this.state.ourColor = "X";
                this.state.opponentColor = "O";
            }
        }

        countStones() {
            let count = 0;
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (this.state.board[y][x] === "X" || this.state.board[y][x] === "O") {
                        count++;
                    }
                }
            }
            return count;
        }

        // Enhanced move selection based on Bitburner's AI strategies
        selectBestMove() {
            const validMoves = this.getValidMoves();
            if (validMoves.length === 0) return null;

            // Priority 1: Capture opponent stones
            const captureMove = this.findCaptureMove(validMoves);
            if (captureMove) {
                this.ns.print("Selected capture move");
                return captureMove;
            }

            // Priority 2: Defend against capture
            const defendMove = this.findDefendMove(validMoves);
            if (defendMove) {
                this.ns.print("Selected defend move");
                return defendMove;
            }

            // Priority 3: Create eyes for life
            const eyeMove = this.findEyeCreationMove(validMoves);
            if (eyeMove) {
                this.ns.print("Selected eye creation move");
                return eyeMove;
            }

            // Priority 4: Surround opponent with low liberties
            const surroundMove = this.findSurroundMove(validMoves);
            if (surroundMove) {
                this.ns.print("Selected surround move");
                return surroundMove;
            }

            // Priority 5: Block opponent's eye creation
            const blockMove = this.findEyeBlockMove(validMoves);
            if (blockMove) {
                this.ns.print("Selected eye block move");
                return blockMove;
            }

            // Priority 6: Corner moves for territory
            const cornerMove = this.findCornerMove(validMoves);
            if (cornerMove) {
                this.ns.print("Selected corner move");
                return cornerMove;
            }

            // Priority 7: Pattern matching
            const patternMove = this.findPatternMove(validMoves);
            if (patternMove) {
                this.ns.print("Selected pattern move");
                return patternMove;
            }

            // Priority 8: Growth moves
            const growthMove = this.findGrowthMove(validMoves);
            if (growthMove) {
                this.ns.print("Selected growth move");
                return growthMove;
            }

            // Priority 9: Expansion moves
            const expansionMove = this.findExpansionMove(validMoves);
            if (expansionMove) {
                this.ns.print("Selected expansion move");
                return expansionMove;
            }

            // Fallback: Random valid move
            this.ns.print("Selected random move");
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }

        getValidMoves() {
            const validMoves = this.ns.go.analysis.getValidMoves();
            const moves = [];
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (validMoves[y][x]) {
                        moves.push([y, x]);
                    }
                }
            }
            return moves;
        }

        // Find moves that capture opponent stones
        findCaptureMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.wouldCapture(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        wouldCapture(row, col) {
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                if (this.isValidCoord(nc, nr) && this.state.board[nr][nc] === this.state.opponentColor) {
                    const group = this.getGroup(nc, nr);
                    if (this.countLiberties(group) === 1) {
                        return true;
                    }
                }
            }
            return false;
        }

        // Find moves that defend against capture
        findDefendMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.wouldDefend(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        wouldDefend(row, col) {
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                if (this.isValidCoord(nc, nr) && this.state.board[nr][nc] === this.state.ourColor) {
                    const group = this.getGroup(nc, nr);
                    if (this.countLiberties(group) === 1) {
                        return true; // This move would add a liberty to our endangered group
                    }
                }
            }
            return false;
        }

        // Find moves that create eyes
        findEyeCreationMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.wouldCreateEye(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        wouldCreateEye(row, col) {
            // Check if this move would create an eye (empty space surrounded by our stones)
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            let friendlyNeighbors = 0;
            let totalNeighbors = 0;

            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                if (this.isValidCoord(nc, nr)) {
                    totalNeighbors++;
                    if (this.state.board[nr][nc] === this.state.ourColor) {
                        friendlyNeighbors++;
                    }
                } else {
                    totalNeighbors++; // Edge counts as friendly
                    friendlyNeighbors++;
                }
            }

            return friendlyNeighbors >= 3; // At least 3 sides controlled
        }

        // Find moves that surround opponent groups
        findSurroundMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.wouldSurround(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        wouldSurround(row, col) {
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                if (this.isValidCoord(nc, nr) && this.state.board[nr][nc] === this.state.opponentColor) {
                    const group = this.getGroup(nc, nr);
                    if (this.countLiberties(group) <= 2) {
                        return true; // This would reduce opponent's liberties
                    }
                }
            }
            return false;
        }

        // Find moves that block opponent's eye creation
        findEyeBlockMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.wouldBlockEye(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        wouldBlockEye(row, col) {
            // Check if this move would prevent opponent from creating an eye
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            let opponentNeighbors = 0;
            let totalNeighbors = 0;

            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                if (this.isValidCoord(nc, nr)) {
                    totalNeighbors++;
                    if (this.state.board[nr][nc] === this.state.opponentColor) {
                        opponentNeighbors++;
                    }
                } else {
                    totalNeighbors++;
                }
            }

            return opponentNeighbors >= 2; // Opponent has significant presence
        }

        // Find corner moves
        findCornerMove(validMoves) {
            const corners = [
                [2, 2],
                [2, this.boardSize - 3],
                [this.boardSize - 3, 2],
                [this.boardSize - 3, this.boardSize - 3],
            ];

            for (const [row, col] of corners) {
                if (validMoves.some(([r, c]) => r === row && c === col)) {
                    if (this.isCornerGood(row, col)) {
                        return [row, col];
                    }
                }
            }
            return null;
        }

        isCornerGood(row, col) {
            // Check if corner area is mostly empty
            let emptyCount = 0;
            let totalCount = 0;
            for (let r = Math.max(0, row - 2); r <= Math.min(this.boardSize - 1, row + 2); r++) {
                for (let c = Math.max(0, col - 2); c <= Math.min(this.boardSize - 1, col + 2); c++) {
                    totalCount++;
                    if (this.state.board[r][c] === "") {
                        emptyCount++;
                    }
                }
            }
            return emptyCount / totalCount > 0.7;
        }

        // Initialize pattern library (simplified version of Bitburner's patterns)
        initializePatterns() {
            return [
                // Hane patterns
                [
                    ["X", "O", "X"],
                    [".", ".", "."],
                    ["?", "?", "?"],
                ],
                [
                    ["X", "O", "."],
                    [".", ".", "."],
                    ["?", ".", "?"],
                ],
                // Cut patterns
                [
                    ["X", "O", "?"],
                    ["O", ".", "x"],
                    ["?", "x", "?"],
                ],
                // Side patterns
                [
                    ["X", ".", "?"],
                    ["O", ".", "?"],
                    [" ", " ", " "],
                ],
                // Connection patterns
                [
                    ["?", "X", "?"],
                    ["O", ".", "O"],
                    ["x", "x", "x"],
                ],
            ];
        }

        // Find moves matching strategic patterns
        findPatternMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.matchesPattern(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        matchesPattern(row, col) {
            for (const pattern of this.patterns) {
                if (this.checkPattern(row, col, pattern)) {
                    return true;
                }
            }
            return false;
        }

        checkPattern(row, col, pattern) {
            const startRow = row - 1;
            const startCol = col - 1;

            for (let pr = 0; pr < 3; pr++) {
                for (let pc = 0; pc < 3; pc++) {
                    const boardRow = startRow + pr;
                    const boardCol = startCol + pc;
                    const patternChar = pattern[pr][pc];

                    if (!this.matchesPatternChar(boardRow, boardCol, patternChar)) {
                        return false;
                    }
                }
            }
            return true;
        }

        matchesPatternChar(row, col, patternChar) {
            if (patternChar === "?") return true;
            if (patternChar === " ") return !this.isValidCoord(col, row);
            if (patternChar === ".") return this.isValidCoord(col, row) && this.state.board[row][col] === "";
            if (patternChar === "X")
                return this.isValidCoord(col, row) && this.state.board[row][col] === this.state.ourColor;
            if (patternChar === "O")
                return this.isValidCoord(col, row) && this.state.board[row][col] === this.state.opponentColor;
            if (patternChar === "x")
                return !this.isValidCoord(col, row) || this.state.board[row][col] !== this.state.opponentColor;
            if (patternChar === "o")
                return !this.isValidCoord(col, row) || this.state.board[row][col] !== this.state.ourColor;
            return false;
        }

        // Find growth moves (connect to existing stones)
        findGrowthMove(validMoves) {
            for (const [row, col] of validMoves) {
                if (this.isGrowthMove(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        isGrowthMove(row, col) {
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                if (this.isValidCoord(nc, nr) && this.state.board[nr][nc] === this.state.ourColor) {
                    return true;
                }
            }
            return false;
        }

        // Find expansion moves (claim new territory)
        findExpansionMove(validMoves) {
            // Prefer moves that are not too close to existing stones
            for (const [row, col] of validMoves) {
                if (this.isExpansionMove(row, col)) {
                    return [row, col];
                }
            }
            return null;
        }

        isExpansionMove(row, col) {
            let minDistance = Infinity;
            for (let r = 0; r < this.boardSize; r++) {
                for (let c = 0; c < this.boardSize; c++) {
                    if (this.state.board[r][c] !== "") {
                        const distance = Math.abs(r - row) + Math.abs(c - col);
                        minDistance = Math.min(minDistance, distance);
                    }
                }
            }
            return minDistance >= 3; // At least 3 spaces away from existing stones
        }

        // Group analysis functions
        getGroup(x, y) {
            const color = this.state.board[y][x];
            if (color === "" || color === "#") return [];

            const group = [];
            const visited = new Set();
            const stack = [[x, y]];

            while (stack.length > 0) {
                const [cx, cy] = stack.pop();
                const key = `${cx},${cy}`;

                if (visited.has(key)) continue;
                visited.add(key);
                group.push([cx, cy]);

                const directions = [
                    [0, 1],
                    [1, 0],
                    [0, -1],
                    [-1, 0],
                ];
                for (const [dx, dy] of directions) {
                    const nx = cx + dx;
                    const ny = cy + dy;

                    if (
                        this.isValidCoord(nx, ny) &&
                        this.state.board[ny][nx] === color &&
                        !visited.has(`${nx},${ny}`)
                    ) {
                        stack.push([nx, ny]);
                    }
                }
            }

            return group;
        }

        countLiberties(group) {
            const liberties = new Set();
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];

            for (const [x, y] of group) {
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (this.isValidCoord(nx, ny) && this.state.board[ny][nx] === "") {
                        liberties.add(`${nx},${ny}`);
                    }
                }
            }

            return liberties.size;
        }

        isValidCoord(x, y) {
            return x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize;
        }

        // Debug method
        toString() {
            let result = "";
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    const cell = this.state.board[y][x];
                    result += cell === "" ? "." : cell;
                }
                result += "\n";
            }
            return result;
        }
    }

    // Main game loop
    let gameCount = 0;
    let result;

    do {
        gameCount++;
        const ai = new EnhancedBitburnerGoAI(ns);

        ns.print("=== Enhanced AI Analysis ===");
        ns.print("Current board state:");
        ns.print(ai.toString());
        ns.print(`Move count: ${ai.state.moveCount}, Our color: ${ai.state.ourColor}`);

        const validMoves = ai.getValidMoves();
        if (validMoves.length === 0) {
            ns.print("No valid moves available, passing turn");
            result = await ns.go.passTurn();
        } else {
            ns.print(`Analyzing ${validMoves.length} possible moves...`);

            const startTime = Date.now();
            const bestMove = ai.selectBestMove();
            const thinkTime = Date.now() - startTime;

            if (!bestMove) {
                ns.print("AI couldn't find a move, passing turn");
                result = await ns.go.passTurn();
            } else {
                const [row, col] = bestMove;
                ns.print(`Enhanced AI selected move: [${row}, ${col}] (analyzed in ${thinkTime}ms)`);

                result = await ns.go.makeMove(row, col);

                if (result?.type === "invalid") {
                    ns.print(`Invalid move attempted: [${row}, ${col}], passing instead`);
                    result = await ns.go.passTurn();
                } else {
                    ns.print(`Move executed successfully: [${row}, ${col}]`);
                }
            }
        }

        // Wait for opponent
        const opponentMove = await ns.go.opponentNextTurn();

        if (opponentMove?.type === "pass") {
            ns.print("Opponent passed, ending game");
            await ns.go.passTurn();
            break;
        }

        await ns.sleep(100);
    } while (result?.type !== "gameOver" && gameCount < 300);

    // Start new game
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    ns.print(`Starting new game against ${randomOpponent}`);
    ns.go.resetBoardState(randomOpponent, 13);

    // Restart the script
    ns.exec("techLord/master/ipvgo-enhanced-ai.js", "home", 1, ...opponents);
}
