import { NS } from "@ns";

// Import the proven MCTS library
import { MCTS } from "../../lib/mcts/MCTS.js";

/** @param {NS} ns */
export async function main(ns) {
    const opponents = ns.args || ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];

    class BitburnerGoGame {
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
            this.initializeGame();
        }

        initializeGame() {
            // Get current board state from Bitburner
            const boardState = this.ns.go.getBoardState();
            // Board state is already a 2D array, no need to split strings
            this.state.board = boardState.map((row) => [...row]);

            // Determine colors and current player
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

            // Determine our color based on who should move next
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

        // MCTS Interface Methods
        getState() {
            return {
                board: this.state.board.map((row) => [...row]),
                currentPlayer: this.state.currentPlayer,
                gameOver: this.state.gameOver,
                winner: this.state.winner,
                moveCount: this.state.moveCount,
                ourColor: this.state.ourColor,
                opponentColor: this.state.opponentColor,
            };
        }

        setState(state) {
            this.state = {
                board: state.board.map((row) => [...row]),
                currentPlayer: state.currentPlayer,
                gameOver: state.gameOver,
                winner: state.winner,
                moveCount: state.moveCount,
                ourColor: state.ourColor,
                opponentColor: state.opponentColor,
            };
        }

        cloneState() {
            return {
                board: this.state.board.map((row) => [...row]),
                currentPlayer: this.state.currentPlayer,
                gameOver: this.state.gameOver,
                winner: this.state.winner,
                moveCount: this.state.moveCount,
                ourColor: this.state.ourColor,
                opponentColor: this.state.opponentColor,
            };
        }

        moves() {
            if (this.state.gameOver) return [];

            const validMoves = [];
            // Get valid moves from Bitburner API
            const bitburnerMoves = this.ns.go.analysis.getValidMoves();

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (bitburnerMoves[y][x]) {
                        // Return moves as [row, column] to match original script format
                        validMoves.push([y, x]);
                    }
                }
            }

            return validMoves;
        }

        playMove(move) {
            if (this.state.gameOver) return;

            // Move is [row, column] format
            const [row, col] = move;
            const currentColor = this.state.currentPlayer === 1 ? this.state.ourColor : this.state.opponentColor;

            // Place the stone - board is indexed as board[row][col]
            this.state.board[row][col] = currentColor;
            this.state.moveCount++;

            // Check for captures
            this.handleCaptures(col, row, currentColor);

            // Switch players
            this.state.currentPlayer = this.state.currentPlayer === 1 ? 2 : 1;

            // Check for game over conditions
            this.checkGameOver();
        }

        handleCaptures(x, y, playerColor) {
            const opponentColor = playerColor === "X" ? "O" : "X";
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];

            // Check all adjacent opponent groups for captures
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;

                if (this.isValidCoord(nx, ny) && this.state.board[ny][nx] === opponentColor) {
                    const group = this.getGroup(nx, ny);
                    if (this.countLiberties(group) === 0) {
                        // Capture the group
                        for (const [gx, gy] of group) {
                            this.state.board[gy][gx] = "";
                        }
                    }
                }
            }
        }

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

        checkGameOver() {
            // Simple game over check - in a real implementation you'd want more sophisticated logic
            if (this.state.moveCount > 160) {
                // Reasonable move limit for 13x13
                this.state.gameOver = true;
                this.evaluateWinner();
            }
        }

        evaluateWinner() {
            // Simple territory counting
            let ourTerritory = 0;
            let opponentTerritory = 0;

            // Count stones and basic territory
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (this.state.board[y][x] === this.state.ourColor) {
                        ourTerritory += 1;
                    } else if (this.state.board[y][x] === this.state.opponentColor) {
                        opponentTerritory += 1;
                    }
                }
            }

            // Use Bitburner's territory analysis if available
            try {
                const controlled = this.ns.go.analysis.getControlledEmptyNodes();
                for (let y = 0; y < this.boardSize; y++) {
                    for (let x = 0; x < this.boardSize; x++) {
                        if (controlled[y][x] === this.state.ourColor) {
                            ourTerritory += 1;
                        } else if (controlled[y][x] === this.state.opponentColor) {
                            opponentTerritory += 1;
                        }
                    }
                }
            } catch (e) {
                // Fallback if API not available
            }

            if (ourTerritory > opponentTerritory) {
                this.state.winner = 1; // We win
            } else if (opponentTerritory > ourTerritory) {
                this.state.winner = 2; // Opponent wins
            } else {
                this.state.winner = -1; // Draw
            }
        }

        gameOver() {
            return this.state.gameOver;
        }

        winner() {
            return this.state.winner;
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
    let adaptiveIterations = 50; // Start with very low iterations

    do {
        gameCount++;

        // Create game instance
        const game = new BitburnerGoGame(ns);

        // Adjust iterations based on game stage
        const moveCount = game.state.moveCount;
        let iterations;

        if (moveCount < 20) {
            // Early game - use fewer iterations for faster play
            iterations = Math.min(adaptiveIterations, 30);
        } else if (moveCount < 100) {
            // Mid game - moderate iterations
            iterations = Math.min(adaptiveIterations, 80);
        } else {
            // Late game - more careful analysis
            iterations = Math.min(adaptiveIterations, 150);
        }

        const exploration = 1.41; // Standard UCB1 exploration parameter
        const aiPlayer = new MCTS(game, 1, iterations, exploration);

        ns.print("Current board state:");
        ns.print(game.toString());

        // Check if we have valid moves
        const validMoves = game.moves();
        if (validMoves.length === 0) {
            ns.print("No valid moves available, passing turn");
            result = await ns.go.passTurn();
        } else {
            ns.print(
                `AI analyzing ${validMoves.length} possible moves with ${iterations} MCTS iterations (adaptive: ${adaptiveIterations})...`,
            );

            // Get AI move with timeout protection
            const startTime = Date.now();
            const aiMove = aiPlayer.selectMove();
            const thinkTime = Date.now() - startTime;

            // Adaptive iteration adjustment based on performance
            if (thinkTime > 3000) {
                // 3 seconds - too slow
                adaptiveIterations = Math.max(20, adaptiveIterations - 10);
                ns.print(`Reducing iterations to ${adaptiveIterations} (took ${thinkTime}ms)`);
            } else if (thinkTime < 500 && adaptiveIterations < 100) {
                // Under 0.5s - can handle more
                adaptiveIterations = Math.min(100, adaptiveIterations + 5);
                ns.print(`Increasing iterations to ${adaptiveIterations} (took ${thinkTime}ms)`);
            } else {
                ns.print(`Move calculated in ${thinkTime}ms`);
            }

            if (!aiMove) {
                ns.print("AI couldn't find a move, passing turn");
                result = await ns.go.passTurn();
            } else {
                // aiMove is now [row, col] format like the original script
                const [row, col] = aiMove;
                ns.print(`AI selected move: [${row}, ${col}] (thought for ${thinkTime}ms)`);

                // Make the move in Bitburner - use row, column format like original
                result = await ns.go.makeMove(row, col);

                if (result?.type === "invalid") {
                    ns.print(`Invalid move attempted: [${row}, ${col}], passing instead`);
                    result = await ns.go.passTurn();
                } else {
                    ns.print(`Move made successfully: [${row}, ${col}]`);
                }
            }
        }

        // Wait for opponent - following the original pattern
        const opponentMove = await ns.go.opponentNextTurn();

        if (opponentMove?.type === "pass") {
            ns.print("Opponent passed, ending game");
            await ns.go.passTurn();
            break;
        }

        // Add a small delay like the original
        await ns.sleep(100);
    } while (result?.type !== "gameOver" && gameCount < 300);

    // Start new game
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    ns.print(`Starting new game against ${randomOpponent}`);
    ns.go.resetBoardState(randomOpponent, 13);

    // Restart the script
    ns.exec("techLord/master/ipvgo-mcts.js", "home", 1, ...opponents);
}
