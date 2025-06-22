import { NS } from "@ns";

// Import the local copy of @sabaki/go-board
// Note: Using require() since the library uses CommonJS exports
import { Board } from "../../lib/sabaki/GoBoard.js";

/** @param {NS} ns */
export async function main(ns) {
    const opponents = ns.args || ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];

    class AdvancedGoAI {
        constructor(ns) {
            this.ns = ns;
            this.boardSize = 13;
            this.ourColor = null;
            this.opponentColor = null;
            this.isFirstMove = true;
            this.moveHistory = [];
            this.mctsIterations = 500; // Number of MCTS simulations per move
            this.explorationConstant = Math.sqrt(2); // UCB1 exploration parameter
            this.patterns = this.initializePatterns();
            this.joseki = this.initializeJoseki();
            this.directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];
            this.diagonals = [
                [1, 1],
                [-1, -1],
                [1, -1],
                [-1, 1],
            ];
        }

        // Enhanced liberty counting with obstacle awareness using @sabaki/go-board
        countLiberties(board, x, y) {
            try {
                // Convert to @sabaki/go-board format and use its liberty counting
                const sabakiBoard = this.createBoardFromState(board);
                const boardInstance = new Board(sabakiBoard.signMap);

                // Get liberties using the library's robust implementation
                const liberties = boardInstance.getLiberties([x, y]);
                return liberties ? liberties.length : 0;
            } catch (error) {
                // Fallback to custom implementation if library fails
                this.ns.print(`Library error, using fallback: ${error.message}`);
                return this.countLibertiesCustom(board, x, y);
            }
        }

        // Fallback custom liberty counting (renamed from original)
        countLibertiesCustom(board, x, y) {
            const color = board[y][x];
            if (color === "" || color === "#") return 0;

            const visited = new Set();
            const liberties = new Set();

            const dfs = (cx, cy) => {
                const key = `${cx},${cy}`;
                if (visited.has(key)) return;
                visited.add(key);

                for (const [dx, dy] of this.directions) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (!this.isValidCoord(nx, ny)) continue;

                    if (board[ny][nx] === "") {
                        liberties.add(`${nx},${ny}`);
                    } else if (board[ny][nx] === color) {
                        dfs(nx, ny);
                    }
                    // Note: obstacles (#) are treated as blocking, not liberties
                }
            };

            dfs(x, y);
            return liberties.size;
        }

        // Enhanced move validation using @sabaki/go-board
        isValidMove(board, y, x) {
            try {
                // Use @sabaki/go-board for robust move validation
                const sabakiBoard = this.createBoardFromState(board);
                const boardInstance = new Board(sabakiBoard.signMap);

                // Determine player color (1 for X/black, -1 for O/white)
                const playerSign = this.ourColor === "X" ? 1 : -1;

                // Check if move is valid using library
                const result = boardInstance.makeMove(playerSign, [x, y]);
                return result !== null; // null means invalid move
            } catch (error) {
                // Fallback to basic validation
                this.ns.print(`Move validation fallback: ${error.message}`);
                return this.isValidMoveCustom(board, y, x);
            }
        }

        // Fallback custom move validation
        isValidMoveCustom(board, y, x) {
            // Check bounds
            if (!this.isValidCoord(x, y)) return false;

            // Check if position is empty (not stone or obstacle)
            if (board[y][x] !== "") return false;

            return true;
        }

        // Enhanced board representation with proper @sabaki/go-board integration
        createBoardFromState(board) {
            // Convert Bitburner board format to @sabaki/go-board format
            const signMap = board.map((row) =>
                row.split("").map((cell) => {
                    if (cell === "#") return null; // @sabaki/go-board uses null for inaccessible
                    if (cell === "X") return 1; // Black stone
                    if (cell === "O") return -1; // White stone
                    return 0; // Empty
                }),
            );

            return { signMap, width: this.boardSize, height: this.boardSize };
        }

        // Enhanced group analysis using @sabaki/go-board
        getGroupInfo(board, x, y) {
            try {
                const sabakiBoard = this.createBoardFromState(board);
                const boardInstance = new Board(sabakiBoard.signMap);

                // Get comprehensive group information
                const chain = boardInstance.getChain([x, y]);
                const liberties = boardInstance.getLiberties([x, y]);

                return {
                    stones: chain || [],
                    liberties: liberties || [],
                    size: chain ? chain.length : 0,
                    libertiesCount: liberties ? liberties.length : 0,
                };
            } catch (error) {
                // Fallback to basic counting
                return {
                    stones: [[x, y]],
                    liberties: [],
                    size: 1,
                    libertiesCount: this.countLibertiesCustom(board, x, y),
                };
            }
        }

        // Enhanced pattern recognition with obstacle awareness
        evaluateStoneVulnerability(board, x, y) {
            const color = board[y][x];
            if (color === "" || color === "#") return 0;

            let vulnerabilityScore = 0;
            let adjacentObstacles = 0;
            let adjacentOpponents = 0;
            let adjacentEmpty = 0;
            let adjacentFriendly = 0;

            for (const [dx, dy] of this.directions) {
                const nx = x + dx;
                const ny = y + dy;

                if (!this.isValidCoord(nx, ny)) {
                    adjacentObstacles++; // Board edge
                } else if (board[ny][nx] === "#") {
                    adjacentObstacles++; // Obstacle
                } else if (board[ny][nx] === "") {
                    adjacentEmpty++;
                } else if (board[ny][nx] === color) {
                    adjacentFriendly++;
                } else {
                    adjacentOpponents++;
                }
            }

            const blockedSides = adjacentObstacles + adjacentOpponents;

            // High vulnerability if mostly surrounded
            if (blockedSides >= 3) {
                vulnerabilityScore += 300;
            } else if (blockedSides >= 2) {
                vulnerabilityScore += 150;
            }

            // Obstacles reduce escape routes more than opponent stones
            vulnerabilityScore += adjacentObstacles * 75; // Increased from 50
            vulnerabilityScore -= adjacentFriendly * 30;

            return vulnerabilityScore;
        }

        // Enhanced tactical analysis with obstacle integration using @sabaki/go-board
        findObstacleThreats(board, validMoves) {
            const threats = [];
            if (!this.ourColor) this.determineColors(board);

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === this.ourColor) {
                        // Use enhanced group analysis from @sabaki/go-board
                        const groupInfo = this.getGroupInfo(board, x, y);
                        const vulnerability = this.evaluateStoneVulnerability(board, x, y);
                        const liberties = groupInfo.libertiesCount;

                        // Higher priority for stones near obstacles
                        if (vulnerability > 100 && liberties <= 3) {
                            // Check all liberty positions for defensive moves
                            for (const [lx, ly] of groupInfo.liberties) {
                                if (validMoves[ly] && validMoves[ly][lx]) {
                                    let priority = vulnerability + (4 - liberties) * 100;

                                    // Bonus for moves that create connections away from obstacles
                                    const connectionValue = this.evaluateConnection(board, ly, lx);
                                    const obstacleEscapeBonus = this.evaluateObstacleEscape(board, ly, lx, x, y);

                                    priority += connectionValue + obstacleEscapeBonus;

                                    threats.push({
                                        move: [ly, lx],
                                        priority: priority,
                                        type: "obstacle_defense",
                                        targetStone: [y, x],
                                        groupSize: groupInfo.size,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            return threats;
        }

        // New function to evaluate moves that help escape obstacle traps
        evaluateObstacleEscape(board, moveY, moveX, stoneX, stoneY) {
            let escapeValue = 0;

            // Check if this move creates breathing room away from obstacles
            for (const [dx, dy] of this.directions) {
                const nx = moveX + dx;
                const ny = moveY + dy;

                if (this.isValidCoord(nx, ny)) {
                    if (board[ny][nx] === "") {
                        escapeValue += 20; // Open space is valuable
                    } else if (board[ny][nx] === "#") {
                        escapeValue -= 30; // Avoid moving toward obstacles
                    }
                }
            }

            // Bonus for moves that increase distance from obstacles
            const obstacleDistance = this.getMinObstacleDistance(board, moveX, moveY);
            escapeValue += Math.min(obstacleDistance * 10, 50);

            return escapeValue;
        }

        // Helper function to find minimum distance to any obstacle
        getMinObstacleDistance(board, x, y) {
            let minDistance = this.boardSize;

            for (let oy = 0; oy < this.boardSize; oy++) {
                for (let ox = 0; ox < this.boardSize; ox++) {
                    if (board[oy][ox] === "#") {
                        const distance = Math.abs(x - ox) + Math.abs(y - oy);
                        minDistance = Math.min(minDistance, distance);
                    }
                }
            }

            return minDistance;
        }

        // Initialize tactical and strategic patterns
        initializePatterns() {
            return {
                // Atari patterns - one liberty threats
                atari: [
                    {
                        pattern: [
                            [1, 0, 1],
                            [0, 1, 0],
                        ],
                        priority: 900,
                    },
                    { pattern: [[1], [0], [1]], priority: 900 },
                ],

                // Net patterns - capturing techniques
                nets: [
                    {
                        pattern: [
                            [1, 0, 1],
                            [0, 2, 0],
                            [1, 0, 1],
                        ],
                        priority: 700,
                    },
                    {
                        pattern: [
                            [0, 1, 0],
                            [1, 2, 1],
                            [0, 1, 0],
                        ],
                        priority: 700,
                    },
                ],

                // Good shape patterns
                goodShape: [
                    {
                        pattern: [
                            [1, 0],
                            [0, 1],
                        ],
                        priority: 200,
                    }, // Diagonal connection
                    {
                        pattern: [
                            [1, 1],
                            [0, 0],
                        ],
                        priority: 150,
                    }, // Bamboo joint
                    { pattern: [[1, 0, 1]], priority: 100 }, // Extension
                ],

                // Bad shape patterns to avoid
                badShape: [
                    {
                        pattern: [
                            [1, 1],
                            [1, 0],
                        ],
                        priority: -200,
                    }, // Empty triangle
                    {
                        pattern: [
                            [1, 0, 1],
                            [1, 1, 1],
                        ],
                        priority: -300,
                    }, // Overconcentration
                    {
                        pattern: [
                            [0, 1],
                            [1, 1],
                        ],
                        priority: -150,
                    }, // Heavy shape
                ],

                // Eye patterns for life and death
                eyes: [
                    {
                        pattern: [
                            [1, 1, 1],
                            [1, 0, 1],
                            [1, 1, 1],
                        ],
                        priority: 800,
                    }, // Surrounded eye
                    {
                        pattern: [
                            [0, 1, 0],
                            [1, 0, 1],
                            [0, 1, 0],
                        ],
                        priority: 600,
                    }, // Cross eye
                ],
            };
        }

        // Initialize basic joseki patterns
        initializeJoseki() {
            return {
                // 3-3 invasion joseki
                sansan: [
                    {
                        moves: [
                            [3, 3],
                            [3, 4],
                            [4, 3],
                            [2, 3],
                        ],
                        priority: 300,
                    },
                    {
                        moves: [
                            [3, 3],
                            [2, 3],
                            [3, 2],
                            [4, 3],
                        ],
                        priority: 280,
                    },
                ],

                // 4-4 approach joseki
                hoshi: [
                    {
                        moves: [
                            [4, 4],
                            [3, 6],
                            [6, 3],
                            [3, 3],
                        ],
                        priority: 320,
                    },
                    {
                        moves: [
                            [4, 4],
                            [6, 3],
                            [3, 6],
                            [6, 6],
                        ],
                        priority: 300,
                    },
                ],

                // Corner enclosure patterns
                shimari: [
                    {
                        moves: [
                            [3, 4],
                            [5, 3],
                        ],
                        priority: 250,
                    },
                    {
                        moves: [
                            [4, 3],
                            [3, 5],
                        ],
                        priority: 250,
                    },
                ],
            };
        }

        // Determine our color based on game state
        determineColors(board) {
            if (this.isFirstMove) {
                const totalStones = board.flat().filter((cell) => cell !== "" && cell !== "#").length;
                if (totalStones === 0) {
                    this.ourColor = "X";
                    this.opponentColor = "O";
                    return;
                }
            }

            let xCount = 0,
                oCount = 0;
            for (let y = 0; y < board.length; y++) {
                for (let x = 0; x < board[y].length; x++) {
                    if (board[y][x] === "X") xCount++;
                    else if (board[y][x] === "O") oCount++;
                }
            }

            if (xCount === oCount) {
                this.ourColor = "X";
                this.opponentColor = "O";
            } else if (xCount > oCount) {
                this.ourColor = "O";
                this.opponentColor = "X";
            } else {
                this.ourColor = "X";
                this.opponentColor = "O";
            }
        }

        // Check if coordinates are valid
        isValidCoord(x, y) {
            return x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize;
        }

        // MCTS Node class for tree search
        createMCTSNode(board, move = null, parent = null) {
            return {
                board: board,
                move: move,
                parent: parent,
                children: [],
                visits: 0,
                wins: 0,
                untriedMoves: this.getValidMoves(board),
                playerToMove: this.getPlayerToMove(board),
            };
        }

        // Get valid moves for current board state
        getValidMoves(board) {
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

        // Determine which player's turn it is
        getPlayerToMove(board) {
            let xCount = 0,
                oCount = 0;
            for (let y = 0; y < board.length; y++) {
                for (let x = 0; x < board[y].length; x++) {
                    if (board[y][x] === "X") xCount++;
                    else if (board[y][x] === "O") oCount++;
                }
            }
            return xCount <= oCount ? "X" : "O";
        }

        // UCB1 selection formula for MCTS
        calculateUCB1(node, child, explorationConstant) {
            if (child.visits === 0) return Infinity;

            const exploitation = child.wins / child.visits;
            const exploration = explorationConstant * Math.sqrt(Math.log(node.visits) / child.visits);

            return exploitation + exploration;
        }

        // Select child node using UCB1
        selectChild(node) {
            let bestChild = null;
            let bestValue = -Infinity;

            for (const child of node.children) {
                const ucb1Value = this.calculateUCB1(node, child, this.explorationConstant);
                if (ucb1Value > bestValue) {
                    bestValue = ucb1Value;
                    bestChild = child;
                }
            }
            return bestChild;
        }

        // Expand node by adding a child for an untried move
        expandNode(node) {
            if (node.untriedMoves.length === 0) return null;

            const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
            const move = node.untriedMoves.splice(moveIndex, 1)[0];

            // Simulate making the move
            const newBoard = this.simulateMove(node.board, move, node.playerToMove);
            const child = this.createMCTSNode(newBoard, move, node);
            node.children.push(child);

            return child;
        }

        // Simulate a move on the board
        simulateMove(board, move, player) {
            const newBoard = board.map((row) => [...row]);
            const [y, x] = move;
            newBoard[y][x] = player;
            return newBoard;
        }

        // Simulate a random playout from current position
        simulateRandomPlayout(board, player) {
            let currentBoard = board.map((row) => [...row]);
            let currentPlayer = player;
            let moves = 0;
            const maxMoves = 100; // Prevent infinite games

            while (moves < maxMoves) {
                const validMoves = this.getValidMovesForBoard(currentBoard);
                if (validMoves.length === 0) break;

                // Use policy network-like move selection (weighted random)
                const move = this.selectPlayoutMove(currentBoard, validMoves, currentPlayer);
                if (!move) break;

                currentBoard = this.simulateMove(currentBoard, move, currentPlayer);
                currentPlayer = currentPlayer === "X" ? "O" : "X";
                moves++;
            }

            return this.evaluatePosition(currentBoard);
        }

        // Get valid moves for a specific board state
        getValidMovesForBoard(board) {
            const moves = [];
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === "" && this.isLegalMove(board, [y, x])) {
                        moves.push([y, x]);
                    }
                }
            }
            return moves;
        }

        // Check if a move is legal (basic suicide rule)
        isLegalMove(board, move) {
            const [y, x] = move;
            if (board[y][x] !== "") return false;

            // Check for immediate captures or connections
            for (const [dy, dx] of this.directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (this.isValidCoord(nx, ny) && board[ny][nx] !== "") {
                    return true; // Adjacent to existing stones
                }
            }
            return true; // Empty area is generally legal
        }

        // Select move for playout using policy-like heuristics
        selectPlayoutMove(board, validMoves, player) {
            if (validMoves.length === 0) return null;

            // Weight moves by tactical importance
            const weightedMoves = validMoves.map((move) => {
                const weight = this.evaluateMoveUrgency(board, move, player);
                return { move, weight };
            });

            // Sort by weight and add randomness
            weightedMoves.sort((a, b) => b.weight - a.weight);

            // Select from top moves with some randomness
            const topMoves = weightedMoves.slice(0, Math.min(5, weightedMoves.length));
            const randomIndex = Math.floor(Math.random() * topMoves.length);
            return topMoves[randomIndex].move;
        }

        // Evaluate move urgency for playout policy
        evaluateMoveUrgency(board, move, player) {
            let urgency = Math.random() * 10; // Base randomness

            // Check for captures
            if (this.isCapturingMove(board, move, player)) {
                urgency += 50;
            }

            // Check for escapes
            if (this.isEscapeMove(board, move, player)) {
                urgency += 40;
            }

            // Check for connections
            if (this.isConnectionMove(board, move, player)) {
                urgency += 20;
            }

            // Prefer center and star points
            const center = Math.floor(this.boardSize / 2);
            const distanceFromCenter = Math.abs(move[0] - center) + Math.abs(move[1] - center);
            urgency += Math.max(0, 10 - distanceFromCenter);

            return urgency;
        }

        // Check if move captures opponent stones
        isCapturingMove(board, move, player) {
            const [y, x] = move;
            const opponent = player === "X" ? "O" : "X";

            for (const [dy, dx] of this.directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === opponent) {
                    // Check if opponent group would have no liberties
                    const liberties = this.countLiberties(board, nx, ny);
                    if (liberties <= 1) return true;
                }
            }
            return false;
        }

        // Check if move helps escape from atari
        isEscapeMove(board, move, player) {
            const [y, x] = move;

            for (const [dy, dx] of this.directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === player) {
                    const liberties = this.countLiberties(board, nx, ny);
                    if (liberties <= 2) return true; // Helps group in trouble
                }
            }
            return false;
        }

        // Check if move connects friendly stones
        isConnectionMove(board, move, player) {
            const [y, x] = move;
            let friendlyNeighbors = 0;

            for (const [dy, dx] of this.directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === player) {
                    friendlyNeighbors++;
                }
            }
            return friendlyNeighbors >= 2;
        }

        // A simple flood-fill to estimate territory for a given board state
        estimateTerritory(board) {
            const territory = { our: 0, opponent: 0, neutral: 0 };
            const visited = new Set();
            if (!this.ourColor) this.determineColors(board);

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    const key = `${y},${x}`;
                    if (board[y][x] === "" && !visited.has(key)) {
                        const regionNodes = new Set();
                        const borderColors = new Set();
                        const queue = [[y, x]];
                        visited.add(key);
                        regionNodes.add(key);

                        let head = 0;
                        while (head < queue.length) {
                            const [cy, cx] = queue[head++];

                            for (const [dy, dx] of this.directions) {
                                const ny = cy + dy;
                                const nx = cx + dx;
                                const nkey = `${ny},${nx}`;

                                if (!this.isValidCoord(nx, ny)) continue;

                                if (board[ny][nx] === "") {
                                    if (!visited.has(nkey)) {
                                        visited.add(nkey);
                                        regionNodes.add(nkey);
                                        queue.push([ny, nx]);
                                    }
                                } else if (board[ny][nx] !== "#") {
                                    // Don't count obstacles as border colors
                                    borderColors.add(board[ny][nx]);
                                }
                            }
                        }

                        if (borderColors.size === 1) {
                            const owner = borderColors.values().next().value;
                            if (owner === this.ourColor) {
                                territory.our += regionNodes.size;
                            } else if (owner === this.opponentColor) {
                                territory.opponent += regionNodes.size;
                            }
                        } else {
                            territory.neutral += regionNodes.size;
                        }
                    }
                }
            }
            return territory;
        }

        // Calculate influence radiating from each stone (obstacle-aware)
        calculateInfluence(board) {
            const influenceMap = Array(this.boardSize)
                .fill(null)
                .map(() => Array(this.boardSize).fill(0));
            if (!this.ourColor) this.determineColors(board);

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === "" || board[y][x] === "#") continue; // Skip empty points and obstacles

                    const isOurStone = board[y][x] === this.ourColor;
                    const influenceSign = isOurStone ? 1 : -1;

                    // Radiate influence in a limited radius (Manhattan distance)
                    for (let dy = -4; dy <= 4; dy++) {
                        for (let dx = -4; dx <= 4; dx++) {
                            const ny = y + dy;
                            const nx = x + dx;

                            if (this.isValidCoord(nx, ny) && board[ny][nx] === "") {
                                const distance = Math.abs(dx) + Math.abs(dy);
                                if (distance > 0 && distance <= 4) {
                                    const influence = 5 - distance; // Influence decays with distance
                                    influenceMap[ny][nx] += influenceSign * influence;
                                }
                            }
                        }
                    }
                }
            }
            return influenceMap;
        }

        // Evaluate final position
        evaluatePosition(board) {
            let stoneScore = 0;
            if (!this.ourColor) this.determineColors(board);

            // 1. Count stones
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === this.ourColor) {
                        stoneScore += 1;
                    } else if (board[y][x] === this.opponentColor) {
                        stoneScore -= 1;
                    }
                }
            }

            // 2. Add territory estimation for secure territory
            const territory = this.estimateTerritory(board);
            const territoryScore = territory.our - territory.opponent;

            // 3. Add influence estimation for potential territory
            const influenceMap = this.calculateInfluence(board);
            let influenceScore = 0;
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    // Tally up points of influence, giving a score based on who controls the point
                    if (influenceMap[y][x] > 0) {
                        influenceScore += 1;
                    } else if (influenceMap[y][x] < 0) {
                        influenceScore -= 1;
                    }
                }
            }

            // Combine scores with weights. Territory is most valuable, then stones, then influence.
            const finalScore = 2.0 * territoryScore + 1.0 * stoneScore + 0.5 * influenceScore;

            return finalScore > 0 ? 1 : finalScore < 0 ? 0 : 0.5;
        }

        // Backpropagate MCTS result
        backpropagate(node, result) {
            while (node !== null) {
                node.visits++;
                if (node.playerToMove !== this.ourColor) {
                    node.wins += result;
                } else {
                    node.wins += 1 - result;
                }
                node = node.parent;
            }
        }

        // Main MCTS algorithm
        runMCTS(board) {
            const root = this.createMCTSNode(board);

            for (let i = 0; i < this.mctsIterations; i++) {
                let node = root;

                // Selection phase
                while (node.untriedMoves.length === 0 && node.children.length > 0) {
                    node = this.selectChild(node);
                }

                // Expansion phase
                if (node.untriedMoves.length > 0) {
                    node = this.expandNode(node);
                }

                // Simulation phase
                const result = this.simulateRandomPlayout(node.board, node.playerToMove);

                // Backpropagation phase
                this.backpropagate(node, result);
            }

            // Return best move
            if (root.children.length === 0) return null;

            let bestChild = root.children[0];
            for (const child of root.children) {
                if (child.visits > bestChild.visits) {
                    bestChild = child;
                }
            }

            return bestChild.move;
        }

        // Enhanced tactical moves with obstacle awareness using @sabaki/go-board
        findTacticalMoves(board, validMoves) {
            const tacticalMoves = [];

            // 1. Find groups in atari (1 liberty) - highest priority using library
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] !== "" && board[y][x] !== "#") {
                        const groupInfo = this.getGroupInfo(board, x, y);

                        if (groupInfo.libertiesCount === 1) {
                            // Use the exact liberty positions from the library
                            for (const [lx, ly] of groupInfo.liberties) {
                                if (validMoves[ly] && validMoves[ly][lx]) {
                                    if (board[y][x] === this.ourColor) {
                                        // Save our group - highest priority
                                        tacticalMoves.push({
                                            move: [ly, lx],
                                            priority: 1000,
                                            type: "save_atari",
                                            groupSize: groupInfo.size,
                                        });
                                    } else {
                                        // Capture opponent group - very high priority
                                        tacticalMoves.push({
                                            move: [ly, lx],
                                            priority: 900,
                                            type: "capture_atari",
                                            groupSize: groupInfo.size,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 2. Find obstacle-assisted threats - NEW!
            const obstacleThreats = this.findObstacleThreats(board, validMoves);
            tacticalMoves.push(...obstacleThreats);

            // 3. Find groups with 2-3 liberties that are under attack
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === this.ourColor) {
                        const groupInfo = this.getGroupInfo(board, x, y);

                        if (groupInfo.libertiesCount >= 2 && groupInfo.libertiesCount <= 3) {
                            // Enhanced vulnerability check including obstacles
                            const vulnerability = this.evaluateStoneVulnerability(board, x, y);

                            if (vulnerability > 50) {
                                // Stone is in some danger - use liberty positions from library
                                for (const [lx, ly] of groupInfo.liberties) {
                                    if (validMoves[ly] && validMoves[ly][lx]) {
                                        let connectionValue = this.evaluateConnection(board, ly, lx);
                                        let priority = 400 + connectionValue + vulnerability;

                                        if (groupInfo.libertiesCount === 2) priority += 200; // Extra urgent for 2-liberty groups

                                        tacticalMoves.push({
                                            move: [ly, lx],
                                            priority: priority,
                                            type: "reinforce_vulnerable",
                                            groupSize: groupInfo.size,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 4. Find moves that create atari (put opponent in danger)
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === this.opponentColor) {
                        const groupInfo = this.getGroupInfo(board, x, y);

                        if (groupInfo.libertiesCount === 2) {
                            // Check if opponent is also vulnerable to obstacles
                            const opponentVulnerability = this.evaluateStoneVulnerability(board, x, y);

                            // Check each liberty to see if playing there creates atari
                            for (const [lx, ly] of groupInfo.liberties) {
                                if (validMoves[ly] && validMoves[ly][lx]) {
                                    if (this.wouldCreateAtari(board, ly, lx, x, y)) {
                                        let priority = 500 + opponentVulnerability; // Higher priority if opponent is vulnerable to obstacles

                                        tacticalMoves.push({
                                            move: [ly, lx],
                                            priority: priority,
                                            type: "create_atari",
                                            targetGroupSize: groupInfo.size,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return tacticalMoves;
        }

        // Evaluate how well a move connects to existing friendly stones
        evaluateConnection(board, y, x) {
            let connectionValue = 0;
            let friendlyNeighbors = 0;

            for (const [dy, dx] of this.directions) {
                const ny = y + dy;
                const nx = x + dx;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === this.ourColor) {
                    friendlyNeighbors++;

                    // Bonus for connecting to groups with few liberties (they need help)
                    const neighborLiberties = this.countLiberties(board, nx, ny);
                    if (neighborLiberties <= 3) {
                        connectionValue += 100;
                    } else {
                        connectionValue += 50;
                    }
                }
            }

            // Check diagonal connections too (weaker but still valuable)
            for (const [dy, dx] of this.diagonals) {
                const ny = y + dy;
                const nx = x + dx;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === this.ourColor) {
                    connectionValue += 25;
                }
            }

            return connectionValue;
        }

        // Check if playing at (y,x) would put the group at (targetY, targetX) in atari
        wouldCreateAtari(board, y, x, targetY, targetX) {
            // Simulate the move
            const testBoard = board.map((row) => [...row]);
            testBoard[y][x] = this.ourColor;

            // Count liberties of target group after our move
            const newLiberties = this.countLiberties(testBoard, targetX, targetY);
            return newLiberties === 1;
        }

        // Find strategic moves (territory, influence)
        findStrategicMoves(board, validMoves) {
            const strategicMoves = [];
            const controlled = this.ns.go.analysis.getControlledEmptyNodes();

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (!validMoves[y][x]) continue;

                    let priority = 0;
                    const control = controlled[y][x];

                    // Territory moves
                    if (control === this.ourColor) {
                        priority += 60;
                    } else if (control === this.opponentColor) {
                        priority += 140; // Invasion
                    } else if (control === "?") {
                        priority += 100; // Contest
                    }

                    // Pattern matching
                    priority += this.evaluatePatterns(board, y, x);

                    // Joseki moves
                    priority += this.evaluateJoseki(board, y, x);

                    if (priority > 0) {
                        strategicMoves.push({
                            move: [y, x],
                            priority: priority,
                            type: "strategic",
                        });
                    }
                }
            }

            return strategicMoves;
        }

        // Evaluate patterns around a position
        evaluatePatterns(board, y, x) {
            let score = 0;

            // Check various pattern sizes
            for (let size = 3; size <= 5; size += 2) {
                const pattern = this.extractPattern(board, y, x, size);
                score += this.matchPatterns(pattern);
            }

            return score;
        }

        // Extract pattern around position
        extractPattern(board, centerY, centerX, size) {
            const pattern = [];
            const offset = Math.floor(size / 2);

            for (let dy = -offset; dy <= offset; dy++) {
                const row = [];
                for (let dx = -offset; dx <= offset; dx++) {
                    const ny = centerY + dy;
                    const nx = centerX + dx;

                    if (this.isValidCoord(nx, ny)) {
                        if (board[ny][nx] === this.ourColor) {
                            row.push(1);
                        } else if (board[ny][nx] === this.opponentColor) {
                            row.push(2);
                        } else {
                            row.push(0);
                        }
                    } else {
                        row.push(-1); // Edge
                    }
                }
                pattern.push(row);
            }

            return pattern;
        }

        // Match patterns against known patterns
        matchPatterns(pattern) {
            let score = 0;

            // Check good shape patterns
            for (const goodPattern of this.patterns.goodShape) {
                if (this.patternMatches(pattern, goodPattern.pattern)) {
                    score += goodPattern.priority;
                }
            }

            // Check bad shape patterns
            for (const badPattern of this.patterns.badShape) {
                if (this.patternMatches(pattern, badPattern.pattern)) {
                    score += badPattern.priority;
                }
            }

            return score;
        }

        // Check if patterns match
        patternMatches(board, pattern) {
            if (board.length < pattern.length || board[0].length < pattern[0].length) {
                return false;
            }

            for (let y = 0; y <= board.length - pattern.length; y++) {
                for (let x = 0; x <= board[0].length - pattern[0].length; x++) {
                    let matches = true;
                    for (let py = 0; py < pattern.length; py++) {
                        for (let px = 0; px < pattern[0].length; px++) {
                            if (pattern[py][px] !== 0 && board[y + py][x + px] !== pattern[py][px]) {
                                matches = false;
                                break;
                            }
                        }
                        if (!matches) break;
                    }
                    if (matches) return true;
                }
            }
            return false;
        }

        // Evaluate joseki patterns
        evaluateJoseki(board, y, x) {
            let score = 0;

            // Check corner positions for joseki
            const corners = [
                [3, 3],
                [3, 9],
                [9, 3],
                [9, 9],
            ];
            const isNearCorner = corners.some(([cy, cx]) => Math.abs(y - cy) <= 3 && Math.abs(x - cx) <= 3);

            if (isNearCorner) {
                score += 50; // Bonus for corner play
            }

            // Check for specific joseki patterns
            for (const josekiType of Object.values(this.joseki)) {
                for (const joseki of josekiType) {
                    if (this.isJosekiMove(board, y, x, joseki)) {
                        score += joseki.priority;
                    }
                }
            }

            return score;
        }

        // Check if move fits joseki pattern
        isJosekiMove(board, y, x, joseki) {
            // Simplified joseki matching
            return joseki.moves.some(([jy, jx]) => Math.abs(y - jy) <= 1 && Math.abs(x - jx) <= 1);
        }

        // Get the best move using hybrid approach
        getBestMove(board, validMoves) {
            // Enhanced move selection with obstacle awareness
            let allMoves = [];

            // Tactical moves (highest priority) - now obstacle-aware
            const tacticalMoves = this.findTacticalMoves(board, validMoves);
            allMoves.push(...tacticalMoves);

            // Strategic moves
            const strategicMoves = this.findStrategicMoves(board, validMoves);
            allMoves.push(...strategicMoves);

            // Remove duplicates and sort by priority
            const moveMap = new Map();
            for (const move of allMoves) {
                const key = `${move.move[0]},${move.move[1]}`;
                if (!moveMap.has(key) || moveMap.get(key).priority < move.priority) {
                    moveMap.set(key, move);
                }
            }

            const uniqueMoves = Array.from(moveMap.values());
            uniqueMoves.sort((a, b) => b.priority - a.priority);

            if (uniqueMoves.length > 0) {
                const bestMove = uniqueMoves[0];
                this.ns.print(
                    `Enhanced move: [${bestMove.move[0]}, ${bestMove.move[1]}] - ${bestMove.type} (priority: ${bestMove.priority})`,
                );
                return bestMove.move;
            }

            // Fallback to any valid move
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (validMoves[y][x]) {
                        this.ns.print(`Fallback move: [${y}, ${x}]`);
                        return [y, x];
                    }
                }
            }

            return null;
        }
    }

    const ai = new AdvancedGoAI(ns);
    let result;
    let gameCount = 0;

    do {
        gameCount++;
        const board = ns.go.getBoardState();
        const validMoves = ns.go.analysis.getValidMoves();

        ns.tprint(board);

        const hasValidMoves = validMoves.some((row) => row.some((cell) => cell === true));
        if (!hasValidMoves) {
            ns.print("No valid moves available, game ending");
            break;
        }

        ai.determineColors(board);

        if (ai.isFirstMove) {
            ai.isFirstMove = false;
            ns.print(`Playing as ${ai.ourColor} vs ${ai.opponentColor}`);
        }

        const move = ai.getBestMove(board, validMoves);

        if (!move) {
            ns.print("No move found, passing turn");
            result = await ns.go.passTurn();
        } else {
            const [y, x] = move;
            ns.print(`Making move: [${y}, ${x}]`);
            result = await ns.go.makeMove(y, x);

            if (result?.type === "invalid") {
                ns.print(`Invalid move attempted: [${y}, ${x}], passing instead`);
                result = await ns.go.passTurn();
            }
        }

        const opponentMove = await ns.go.opponentNextTurn();

        if (opponentMove?.type === "pass") {
            ns.print("Opponent passed, ending game");
            await ns.go.passTurn();
            break;
        }

        await ns.sleep(50);
    } while (result?.type !== "gameOver" && gameCount < 300);

    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    ns.print(`Starting new game against ${randomOpponent}`);
    ns.go.resetBoardState(randomOpponent, 13);

    ns.exec("techLord/master/ipvgo-improved.js", "home", 1, ...opponents);
}
