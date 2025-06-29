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
            this.state.board = boardState.map((row) => row.split(""));

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
                        validMoves.push({ x, y });
                    }
                }
            }

            return validMoves;
        }

        playMove(move) {
            if (this.state.gameOver) return;

            const { x, y } = move;
            const currentColor = this.state.currentPlayer === 1 ? this.state.ourColor : this.state.opponentColor;

            // Place the stone
            this.state.board[y][x] = currentColor;
            this.state.moveCount++;

            // Check for captures
            this.handleCaptures(x, y, currentColor);

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

    do {
        gameCount++;

        // Create game instance
        const game = new BitburnerGoGame(ns);

        // Create MCTS AI with reasonable parameters
        const iterations = 1000; // Adjust based on performance needs
        const exploration = 1.41; // Standard UCB1 exploration parameter
        const aiPlayer = new MCTS(game, 1, iterations, exploration);

        ns.tprint("Current board state:");
        ns.tprint(game.toString());

        // Check if we have valid moves
        const validMoves = game.moves();
        if (validMoves.length === 0) {
            ns.print("No valid moves available, passing turn");
            result = await ns.go.passTurn();
            break;
        }

        ns.print(`AI analyzing ${validMoves.length} possible moves with ${iterations} MCTS iterations...`);

        // Get AI move
        const startTime = Date.now();
        const aiMove = aiPlayer.selectMove();
        const thinkTime = Date.now() - startTime;

        if (!aiMove) {
            ns.print("AI couldn't find a move, passing turn");
            result = await ns.go.passTurn();
        } else {
            const { x, y } = aiMove;
            ns.print(`AI selected move: [${y}, ${x}] (thought for ${thinkTime}ms)`);

            // Make the move in Bitburner
            result = await ns.go.makeMove(y, x);

            if (result?.type === "invalid") {
                ns.print(`Invalid move attempted: [${y}, ${x}], passing instead`);
                result = await ns.go.passTurn();
            }
        }

        // Wait for opponent
        const opponentMove = await ns.go.opponentNextTurn();

        if (opponentMove?.type === "pass") {
            ns.print("Opponent passed, ending game");
            await ns.go.passTurn();
            break;
        }

        await ns.sleep(100); // Small delay to prevent overwhelming the system
    } while (result?.type !== "gameOver" && gameCount < 300);

    // Start new game
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    ns.print(`Starting new game against ${randomOpponent}`);
    ns.go.resetBoardState(randomOpponent, 13);

    // Restart the script
    ns.exec("techLord/master/ipvgo-improved.js", "home", 1, ...opponents);
}
