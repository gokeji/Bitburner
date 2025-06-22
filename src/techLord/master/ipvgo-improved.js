import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    const opponents = ns.args || ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];

    class GoAI {
        constructor(ns) {
            this.ns = ns;
            this.boardSize = 13;
            this.ourColor = null;
            this.opponentColor = null;
            this.isFirstMove = true;
            this.moveHistory = [];
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

        // Properly determine our color based on game state
        determineColors(board) {
            // If it's the very first move, we're likely playing as 'X' (black)
            if (this.isFirstMove) {
                const totalStones = board.flat().filter((cell) => cell !== "").length;
                if (totalStones === 0) {
                    this.ourColor = "X"; // We play first as black
                    this.opponentColor = "O";
                    return;
                }
            }

            // Count stones to determine who we are
            let xCount = 0;
            let oCount = 0;

            for (let y = 0; y < board.length; y++) {
                for (let x = 0; x < board[y].length; x++) {
                    if (board[y][x] === "X") xCount++;
                    else if (board[y][x] === "O") oCount++;
                }
            }

            // In Go, black (X) plays first, so if counts are equal, it's black's turn
            // If X has more stones, it's white's turn
            if (xCount === oCount) {
                this.ourColor = "X";
                this.opponentColor = "O";
            } else if (xCount > oCount) {
                this.ourColor = "O";
                this.opponentColor = "X";
            } else {
                // This shouldn't happen in normal play
                this.ourColor = "X";
                this.opponentColor = "O";
            }
        }

        // Check if coordinates are within board bounds
        isValidCoord(x, y) {
            return x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize;
        }

        // Evaluate board position to determine game phase and territorial balance
        evaluateBoardPosition(board) {
            const totalStones = board.flat().filter((cell) => cell !== "").length;
            const center = Math.floor(this.boardSize / 2);

            // Count stones in different areas
            let ourEdge = 0,
                opponentEdge = 0;
            let ourCenter = 0,
                opponentCenter = 0;
            let ourSides = 0,
                opponentSides = 0;

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === "") continue;

                    const isEdge = x <= 2 || x >= this.boardSize - 3 || y <= 2 || y >= this.boardSize - 3;
                    const isCenter = Math.abs(x - center) <= 2 && Math.abs(y - center) <= 2;
                    const isSide = !isEdge && !isCenter;

                    if (board[y][x] === this.ourColor) {
                        if (isEdge) ourEdge++;
                        else if (isCenter) ourCenter++;
                        else ourSides++;
                    } else {
                        if (isEdge) opponentEdge++;
                        else if (isCenter) opponentCenter++;
                        else opponentSides++;
                    }
                }
            }

            return {
                totalStones,
                ourEdge,
                opponentEdge,
                ourCenter,
                opponentCenter,
                ourSides,
                opponentSides,
                centerDeficit: opponentCenter - ourCenter,
                gamePhase: totalStones < 30 ? "opening" : totalStones < 80 ? "middle" : "endgame",
            };
        }

        // Find invasion and reduction moves
        findInvasionMoves(board, validMoves) {
            const controlled = this.ns.go.analysis.getControlledEmptyNodes();
            const invasionMoves = [];
            const position = this.evaluateBoardPosition(board);

            // If we're losing the center badly, prioritize center invasions
            if (position.centerDeficit > 3) {
                const center = Math.floor(this.boardSize / 2);

                // Look for invasion points in opponent territory
                for (let y = 0; y < this.boardSize; y++) {
                    for (let x = 0; x < this.boardSize; x++) {
                        if (!validMoves[y][x]) continue;

                        const control = controlled[y][x];
                        if (control === this.opponentColor) {
                            // This is opponent territory - consider invasion
                            let invasionValue = 0;

                            // Higher value for center invasions
                            const distanceFromCenter = Math.abs(x - center) + Math.abs(y - center);
                            if (distanceFromCenter <= 3) {
                                invasionValue += 200; // Center invasion bonus
                            }

                            // Check if we can make a base here
                            let liberties = 0;
                            let opponentAdjacent = 0;

                            for (const [dx, dy] of this.directions) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (this.isValidCoord(nx, ny)) {
                                    if (board[ny][nx] === "") liberties++;
                                    else if (board[ny][nx] === this.opponentColor) opponentAdjacent++;
                                }
                            }

                            // Good invasion points have some space to make a base
                            if (liberties >= 2 && opponentAdjacent <= 2) {
                                invasionValue += liberties * 30;

                                invasionMoves.push({
                                    move: [y, x],
                                    priority: invasionValue,
                                    type: "invasion",
                                });
                            }
                        }
                    }
                }
            }

            return invasionMoves;
        }

        // Detect cutting points - critical weaknesses in our position
        findCuttingPoints(board, validMoves) {
            const cuttingMoves = [];

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (!validMoves[y][x]) continue;

                    // Check if this empty point separates our stones
                    let ourStones = [];
                    for (const [dx, dy] of this.directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (this.isValidCoord(nx, ny) && board[ny][nx] === this.ourColor) {
                            ourStones.push([nx, ny]);
                        }
                    }

                    // If we have 2+ stones around this point, it might be a cutting point
                    if (ourStones.length >= 2) {
                        // Check if these stones are from different groups
                        const chains = this.ns.go.analysis.getChains();
                        const uniqueChains = new Set();
                        for (const [sx, sy] of ourStones) {
                            uniqueChains.add(chains[sy][sx]);
                        }

                        if (uniqueChains.size > 1) {
                            // This is a cutting point - protect it!
                            cuttingMoves.push({
                                move: [y, x],
                                priority: 800,
                                type: "protect_cut",
                            });
                        }
                    }

                    // Also check if opponent can cut us here
                    let opponentStones = [];
                    for (const [dx, dy] of this.directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (this.isValidCoord(nx, ny) && board[ny][nx] === this.opponentColor) {
                            opponentStones.push([nx, ny]);
                        }
                    }

                    if (opponentStones.length >= 2 && ourStones.length >= 1) {
                        // Opponent might be trying to cut us - block it
                        cuttingMoves.push({
                            move: [y, x],
                            priority: 700,
                            type: "block_cut",
                        });
                    }
                }
            }

            return cuttingMoves;
        }

        // Find critical moves using the liberties API
        findCriticalMoves(board, validMoves) {
            const liberties = this.ns.go.analysis.getLiberties();
            const criticalMoves = [];

            // Find groups in atari (1 liberty) - both ours to save and opponent's to capture
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] !== "" && liberties[y][x] === 1) {
                        // Find the liberty point
                        for (const [dx, dy] of this.directions) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (this.isValidCoord(nx, ny) && board[ny][nx] === "" && validMoves[ny][nx]) {
                                if (board[y][x] === this.ourColor) {
                                    // Save our group - highest priority
                                    criticalMoves.push({
                                        move: [ny, nx],
                                        priority: 1000,
                                        type: "save",
                                    });
                                } else if (board[y][x] === this.opponentColor) {
                                    // Capture opponent group - very high priority
                                    criticalMoves.push({
                                        move: [ny, nx],
                                        priority: 900,
                                        type: "capture",
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Find groups with 2 liberties that we can put in atari
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === this.opponentColor && liberties[y][x] === 2) {
                        // Find liberty points and see if we can reduce to 1
                        const libertyPoints = [];
                        for (const [dx, dy] of this.directions) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (this.isValidCoord(nx, ny) && board[ny][nx] === "" && validMoves[ny][nx]) {
                                libertyPoints.push([ny, nx]);
                            }
                        }

                        // Add moves to put opponent in atari
                        for (const [ly, lx] of libertyPoints) {
                            criticalMoves.push({
                                move: [ly, lx],
                                priority: 400,
                                type: "atari",
                            });
                        }
                    }
                }
            }

            return criticalMoves;
        }

        // Check if a move creates good or bad shape
        evaluateShape(board, y, x) {
            let shapeScore = 0;

            // Count our stones nearby
            let friendlyCount = 0;
            let friendlyPositions = [];

            for (const [dx, dy] of this.directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === this.ourColor) {
                    friendlyCount++;
                    friendlyPositions.push([nx, ny]);
                }
            }

            // Avoid heavy concentrations (more than 2 adjacent stones)
            if (friendlyCount > 2) {
                shapeScore -= 150; // Reduced penalty to allow some center fighting
            }

            // Check for good shapes
            if (friendlyCount === 1) {
                shapeScore += 50; // Extension is often good
            } else if (friendlyCount === 2) {
                // Check if it's a good connection
                const [pos1, pos2] = friendlyPositions;
                const dx1 = pos1[0] - x,
                    dy1 = pos1[1] - y;
                const dx2 = pos2[0] - x,
                    dy2 = pos2[1] - y;

                // Avoid creating empty triangles (bad shape)
                if (Math.abs(dx1 - dx2) + Math.abs(dy1 - dy2) === 2) {
                    // Check if there's a stone at the triangle point
                    const triangleX = pos1[0] + (dx2 - dx1);
                    const triangleY = pos1[1] + (dy2 - dy1);
                    if (this.isValidCoord(triangleX, triangleY) && board[triangleY][triangleX] === this.ourColor) {
                        shapeScore -= 100; // Reduced empty triangle penalty
                    }
                }

                shapeScore += 30; // Connection bonus
            }

            // Check diagonal points for better shape evaluation
            let diagonalFriendlies = 0;
            for (const [dx, dy] of this.diagonals) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.isValidCoord(nx, ny) && board[ny][nx] === this.ourColor) {
                    diagonalFriendlies++;
                }
            }

            // Too many diagonal connections can also be heavy
            if (diagonalFriendlies > 2) {
                shapeScore -= 80; // Reduced penalty
            }

            return shapeScore;
        }

        // Evaluate territorial moves using the control analysis
        evaluateTerritory(board, validMoves) {
            const controlled = this.ns.go.analysis.getControlledEmptyNodes();
            const territoryMoves = [];
            const position = this.evaluateBoardPosition(board);

            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (!validMoves[y][x]) continue;

                    let priority = 0;
                    const control = controlled[y][x];
                    const center = Math.floor(this.boardSize / 2);
                    const distanceFromCenter = Math.abs(x - center) + Math.abs(y - center);

                    // Prioritize moves that:
                    // 1. Secure our territory
                    // 2. Invade opponent territory
                    // 3. Contest disputed areas

                    if (control === this.ourColor) {
                        priority += 60; // Secure our territory
                    } else if (control === this.opponentColor) {
                        priority += 140; // Invade opponent territory (increased)

                        // Extra bonus for center invasions if we're behind there
                        if (position.centerDeficit > 2 && distanceFromCenter <= 3) {
                            priority += 100;
                        }
                    } else if (control === "?") {
                        priority += 120; // Contest disputed territory

                        // Extra bonus for center contests
                        if (distanceFromCenter <= 3) {
                            priority += 80;
                        }
                    }

                    // Add influence from nearby stones (but weight it less heavily)
                    let ourNearby = 0;
                    let opponentNearby = 0;

                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (this.isValidCoord(nx, ny) && board[ny][nx] !== "") {
                                const distance = Math.abs(dx) + Math.abs(dy);
                                const weight = Math.max(0, 3 - distance);

                                if (board[ny][nx] === this.ourColor) {
                                    ourNearby += weight;
                                } else if (board[ny][nx] === this.opponentColor) {
                                    opponentNearby += weight;
                                }
                            }
                        }
                    }

                    priority += ourNearby * 4 + opponentNearby * 6; // Slightly increased weights

                    // Add shape evaluation
                    const shapeScore = this.evaluateShape(board, y, x);
                    priority += shapeScore;

                    if (priority > 0) {
                        territoryMoves.push({
                            move: [y, x],
                            priority: priority,
                            type: "territory",
                        });
                    }
                }
            }

            return territoryMoves;
        }

        // Get strategic opening moves with better spacing and center awareness
        getStrategicMoves(board, validMoves) {
            const position = this.evaluateBoardPosition(board);
            const strategicMoves = [];
            const center = Math.floor(this.boardSize / 2);

            if (position.gamePhase === "opening") {
                // Early game - balance edge and center
                const goodPoints = [
                    // Side star points - good for light play (higher priority)
                    [3, center],
                    [9, center],
                    [center, 3],
                    [center, 9],
                    // 3-3 points (secure territory)
                    [3, 3],
                    [3, 9],
                    [9, 3],
                    [9, 9],
                    // 4-4 points (influence)
                    [4, 4],
                    [4, 8],
                    [8, 4],
                    [8, 8],
                    // Center approaches
                    [center - 1, center],
                    [center + 1, center],
                    [center, center - 1],
                    [center, center + 1],
                    // Center - if opponent is getting too much
                    [center, center],
                ];

                for (const [y, x] of goodPoints) {
                    if (this.isValidCoord(x, y) && validMoves[y][x]) {
                        // Check if this point is too close to existing stones
                        let tooClose = false;
                        let minDistance = 999;

                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dx = -2; dx <= 2; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (this.isValidCoord(nx, ny) && board[ny][nx] === this.ourColor) {
                                    const dist = Math.abs(dx) + Math.abs(dy);
                                    minDistance = Math.min(minDistance, dist);
                                    if (dist <= 1) {
                                        tooClose = true;
                                        break;
                                    }
                                }
                            }
                            if (tooClose) break;
                        }

                        if (!tooClose) {
                            let priority = 220;
                            const distanceFromCenter = Math.abs(x - center) + Math.abs(y - center);

                            // Adjust priority based on center control
                            if (position.centerDeficit > 2 && distanceFromCenter <= 2) {
                                priority += 150; // Urgent center play
                            } else if (y === center || x === center) {
                                priority = 300; // Side star points
                            } else if (distanceFromCenter <= 1) {
                                priority = 280; // Center approaches
                            } else if (y === 3 || y === 9 || x === 3 || x === 9) {
                                priority = 250; // Corner approaches
                            }

                            strategicMoves.push({
                                move: [y, x],
                                priority: priority,
                                type: "opening",
                            });
                        }
                    }
                }
            } else if (position.gamePhase === "middle") {
                // Mid game - focus on center fighting and connections
                const extensions = [];

                // Find our stones and create extension points
                for (let y = 0; y < this.boardSize; y++) {
                    for (let x = 0; x < this.boardSize; x++) {
                        if (board[y][x] === this.ourColor) {
                            // Add extension points at distance 2-3
                            for (const [dx, dy] of this.directions) {
                                for (let dist = 2; dist <= 3; dist++) {
                                    const nx = x + dx * dist;
                                    const ny = y + dy * dist;
                                    if (this.isValidCoord(nx, ny) && validMoves[ny][nx]) {
                                        extensions.push([ny, nx]);
                                    }
                                }
                            }
                        }
                    }
                }

                for (const [y, x] of extensions) {
                    // Make sure it's not too close to other our stones
                    let minDistance = 999;
                    for (let sy = 0; sy < this.boardSize; sy++) {
                        for (let sx = 0; sx < this.boardSize; sx++) {
                            if (board[sy][sx] === this.ourColor) {
                                const dist = Math.abs(sx - x) + Math.abs(sy - y);
                                minDistance = Math.min(minDistance, dist);
                            }
                        }
                    }

                    if (minDistance >= 2) {
                        // Good spacing
                        let priority = 180;
                        const distanceFromCenter = Math.abs(x - center) + Math.abs(y - center);

                        // Bonus for center extensions if we're behind
                        if (position.centerDeficit > 1 && distanceFromCenter <= 4) {
                            priority += 120;
                        }

                        strategicMoves.push({
                            move: [y, x],
                            priority: priority,
                            type: "extension",
                        });
                    }
                }
            }

            return strategicMoves;
        }

        // Find defensive moves to protect our groups
        findDefensiveMoves(board, validMoves) {
            const liberties = this.ns.go.analysis.getLiberties();
            const chains = this.ns.go.analysis.getChains();
            const defensiveMoves = [];

            // Protect groups with few liberties
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === this.ourColor) {
                        const groupLiberties = liberties[y][x];

                        if (groupLiberties <= 3 && groupLiberties > 1) {
                            // Find moves that increase liberties or create better shape
                            for (const [dx, dy] of this.directions) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (this.isValidCoord(nx, ny) && board[ny][nx] === "" && validMoves[ny][nx]) {
                                    let priority = 0;

                                    if (groupLiberties === 2)
                                        priority = 600; // Very urgent
                                    else if (groupLiberties === 3) priority = 300; // Important

                                    // Prefer moves that don't create heavy shape
                                    const shapeScore = this.evaluateShape(board, ny, nx);
                                    priority += shapeScore;

                                    // Check if this move connects to other friendly stones
                                    let connections = 0;
                                    for (const [dx2, dy2] of this.directions) {
                                        const nx2 = nx + dx2;
                                        const ny2 = ny + dy2;
                                        if (this.isValidCoord(nx2, ny2) && board[ny2][nx2] === this.ourColor) {
                                            connections++;
                                        }
                                    }

                                    if (connections <= 2) {
                                        // Avoid overconnection
                                        priority += connections * 50; // Connection bonus
                                    } else {
                                        priority -= 80; // Reduced penalty for heavy shape
                                    }

                                    if (priority > 0) {
                                        defensiveMoves.push({
                                            move: [ny, nx],
                                            priority: priority,
                                            type: "defense",
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return defensiveMoves;
        }

        // Get the best move considering all factors
        getBestMove(board, validMoves) {
            let allMoves = [];
            const position = this.evaluateBoardPosition(board);

            // 1. Critical moves (atari, captures, saves)
            const criticalMoves = this.findCriticalMoves(board, validMoves);
            allMoves.push(...criticalMoves);

            // 2. Cutting point moves (very important for shape)
            const cuttingMoves = this.findCuttingPoints(board, validMoves);
            allMoves.push(...cuttingMoves);

            // 3. Invasion moves (important if losing center)
            const invasionMoves = this.findInvasionMoves(board, validMoves);
            allMoves.push(...invasionMoves);

            // 4. Defensive moves
            const defensiveMoves = this.findDefensiveMoves(board, validMoves);
            allMoves.push(...defensiveMoves);

            // 5. Strategic/opening moves
            const strategicMoves = this.getStrategicMoves(board, validMoves);
            allMoves.push(...strategicMoves);

            // 6. Territory moves
            const territoryMoves = this.evaluateTerritory(board, validMoves);
            allMoves.push(...territoryMoves.slice(0, 15)); // More territory moves for better coverage

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

            // Fallback to any valid move (but try to avoid heavy concentrations)
            if (uniqueMoves.length === 0) {
                const fallbackMoves = [];
                for (let y = 0; y < this.boardSize; y++) {
                    for (let x = 0; x < this.boardSize; x++) {
                        if (validMoves[y][x]) {
                            const shapeScore = this.evaluateShape(board, y, x);
                            fallbackMoves.push({
                                move: [y, x],
                                priority: shapeScore,
                                type: "fallback",
                            });
                        }
                    }
                }

                if (fallbackMoves.length > 0) {
                    fallbackMoves.sort((a, b) => b.priority - a.priority);
                    return fallbackMoves[0].move;
                }

                return null;
            }

            const bestMove = uniqueMoves[0];

            // Debug logging with position info
            this.ns.print(
                `Best move: [${bestMove.move[0]}, ${bestMove.move[1]}] - ${bestMove.type} (priority: ${bestMove.priority})`,
            );
            this.ns.print(`Position: Phase=${position.gamePhase}, Center deficit=${position.centerDeficit}`);

            return bestMove.move;
        }
    }

    const ai = new GoAI(ns);
    let result;
    let gameCount = 0;

    do {
        gameCount++;
        const board = ns.go.getBoardState();
        const validMoves = ns.go.analysis.getValidMoves();

        // Check if game is over
        const hasValidMoves = validMoves.some((row) => row.some((cell) => cell === true));
        if (!hasValidMoves) {
            ns.print("No valid moves available, game ending");
            break;
        }

        // Determine our color
        ai.determineColors(board);

        if (ai.isFirstMove) {
            ai.isFirstMove = false;
            ns.print(`Playing as ${ai.ourColor} vs ${ai.opponentColor}`);
        }

        // Get the best move
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

        // Handle opponent's turn
        const opponentMove = await ns.go.opponentNextTurn();

        if (opponentMove?.type === "pass") {
            ns.print("Opponent passed, ending game");
            await ns.go.passTurn();
            break;
        }

        // Small delay to prevent overwhelming the system
        await ns.sleep(50);
    } while (result?.type !== "gameOver" && gameCount < 300); // Safety limit

    // Game over, check results
    // const stats = ns.go.sta
    // ns.print("Game finished. Stats:", JSON.stringify(stats, null, 2));

    // Reset and start new game
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    ns.print(`Starting new game against ${randomOpponent}`);
    ns.go.resetBoardState(randomOpponent, 13);

    // Restart the script
    ns.exec("techLord/master/ipvgo-improved.js", "home", 1, ...opponents);
}
