import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns) {
    const opponents = ns.args || ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];

    class IlluminatiGoAI {
        constructor(ns) {
            this.ns = ns;
            this.boardSize = 13;
            this.GoColor = {
                empty: "",
                black: "X",
                white: "O",
            };
        }

        // Main move selection logic - exact copy of Illuminati AI
        async selectMove() {
            const boardState = this.ns.go.getBoardState();
            const player = this.determineOurColor(boardState);
            const availableSpaces = this.getAvailableSpaces(boardState);
            const moves = this.getMoveOptions(boardState, player, Math.random());

            // Illuminati priority logic
            const captureMove = await moves.capture();
            if (captureMove) {
                this.ns.print("Illuminati AI: capture move chosen");
                return [captureMove.point.y, captureMove.point.x]; // Convert to [row, col]
            }

            const defendCaptureMove = await moves.defendCapture();
            if (defendCaptureMove) {
                this.ns.print("Illuminati AI: defend capture move chosen");
                return [defendCaptureMove.point.y, defendCaptureMove.point.x];
            }

            const eyeMove = moves.eyeMove();
            if (eyeMove) {
                this.ns.print("Illuminati AI: Create eye move chosen");
                return [eyeMove.point.y, eyeMove.point.x];
            }

            const surround = moves.surround();
            if (surround && surround.point && (surround?.newLibertyCount ?? 9) <= 1) {
                this.ns.print("Illuminati AI: surround move chosen");
                return [surround.point.y, surround.point.x];
            }

            const eyeBlockMove = moves.eyeBlock();
            if (eyeBlockMove) {
                this.ns.print("Illuminati AI: Block eye move chosen");
                return [eyeBlockMove.point.y, eyeBlockMove.point.x];
            }

            const cornerMove = moves.corner();
            if (cornerMove) {
                this.ns.print("Illuminati AI: Corner move chosen");
                return [cornerMove.point.y, cornerMove.point.x];
            }

            const hasMoves = [moves.eyeMove(), moves.eyeBlock(), moves.growth(), moves.defend(), surround].filter(
                (m) => m,
            ).length;
            const rng = Math.random();
            const usePattern = rng > 0.25 || !hasMoves;

            const patternMove = await moves.pattern();
            if (patternMove && usePattern) {
                this.ns.print("Illuminati AI: pattern match move chosen");
                return [patternMove.point.y, patternMove.point.x];
            }

            if (rng > 0.4) {
                const jumpMove = moves.jump();
                if (jumpMove) {
                    this.ns.print("Illuminati AI: Jump move chosen");
                    return [jumpMove.point.y, jumpMove.point.x];
                }
            }

            if (rng < 0.6 && surround && surround.point && (surround?.newLibertyCount ?? 9) <= 2) {
                this.ns.print("Illuminati AI: surround move chosen");
                return [surround.point.y, surround.point.x];
            }

            // Fallback moves
            const growthMove = moves.growth();
            if (growthMove) {
                this.ns.print("Illuminati AI: growth move chosen");
                return [growthMove.point.y, growthMove.point.x];
            }

            const defendMove = moves.defend();
            if (defendMove) {
                this.ns.print("Illuminati AI: defend move chosen");
                return [defendMove.point.y, defendMove.point.x];
            }

            const expansionMove = moves.expansion();
            if (expansionMove) {
                this.ns.print("Illuminati AI: expansion move chosen");
                return [expansionMove.point.y, expansionMove.point.x];
            }

            const randomMove = moves.random();
            if (randomMove) {
                this.ns.print("Illuminati AI: random move chosen");
                return [randomMove.point.y, randomMove.point.x];
            }

            return null;
        }

        determineOurColor(board) {
            let xCount = 0,
                oCount = 0;
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (board[y][x] === "X") xCount++;
                    else if (board[y][x] === "O") oCount++;
                }
            }

            if (xCount === oCount) {
                return "X";
            } else if (xCount > oCount) {
                return "O";
            } else {
                return "X";
            }
        }

        getAvailableSpaces(board) {
            const validMoves = this.ns.go.analysis.getValidMoves();
            const spaces = [];
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    if (validMoves[y][x]) {
                        spaces.push({ x: x, y: y, color: this.GoColor.empty });
                    }
                }
            }
            return spaces;
        }

        // Port of getMoveOptions function
        getMoveOptions(board, player, rng) {
            const availableSpaces = this.getAvailableSpaces(board);
            const smart = true;

            const moveOptions = {};

            const moveOptionGetters = {
                capture: async () => {
                    const surroundMove = moveOptionGetters.surround();
                    return surroundMove && surroundMove?.newLibertyCount === 0 ? surroundMove : null;
                },
                defendCapture: async () => {
                    const defendMove = moveOptionGetters.defend();
                    return defendMove &&
                        defendMove.oldLibertyCount == 1 &&
                        defendMove?.newLibertyCount &&
                        defendMove?.newLibertyCount > 1
                        ? defendMove
                        : null;
                },
                eyeMove: () => this.getEyeCreationMove(board, player, availableSpaces),
                eyeBlock: () => this.getEyeBlockingMove(board, player, availableSpaces),
                pattern: async () => {
                    const point = await this.findPatternMove(board, player, availableSpaces, smart, rng);
                    return point ? { point } : null;
                },
                growth: () => this.getGrowthMove(board, player, availableSpaces, rng),
                expansion: () => this.getExpansionMove(board, availableSpaces, rng),
                jump: () => this.getJumpMove(board, player, availableSpaces, rng),
                defend: () => this.getDefendMove(board, player, availableSpaces),
                surround: () => this.getSurroundMove(board, player, availableSpaces, smart),
                corner: () => {
                    const point = this.getCornerMove(board);
                    return point ? { point } : null;
                },
                random: () => {
                    const point = availableSpaces.length
                        ? availableSpaces[Math.floor(rng * availableSpaces.length)]
                        : null;
                    return point ? { point } : null;
                },
            };

            return moveOptionGetters;
        }

        // Port of getSurroundMove function
        getSurroundMove(board, player, availableSpaces, smart = true) {
            const opposingPlayer = player === "X" ? "O" : "X";
            const enemyChains = this.getAllChains(board).filter((chain) => chain[0].color === opposingPlayer);

            if (!enemyChains.length || !availableSpaces.length) {
                return null;
            }

            const enemyLiberties = enemyChains
                .map((chain) => chain[0].liberties)
                .flat()
                .filter((liberty) => availableSpaces.find((point) => liberty?.x === point.x && liberty?.y === point.y))
                .filter((liberty) => liberty != null);

            const captureMoves = [];
            const atariMoves = [];
            const surroundMoves = [];

            enemyLiberties.forEach((move) => {
                const newLibertyCount = this.findEffectiveLibertiesOfNewMove(board, move.x, move.y, player).length;
                const weakestEnemyChain = this.findEnemyNeighborChainWithFewestLiberties(
                    board,
                    move.x,
                    move.y,
                    opposingPlayer,
                );
                const weakestEnemyChainLength = weakestEnemyChain?.length ?? 99;
                const enemyChainLibertyCount = weakestEnemyChain?.[0]?.liberties?.length ?? 99;

                const enemyLibertyGroups = [
                    ...(weakestEnemyChain?.[0]?.liberties ?? []).reduce(
                        (chainIDs, point) => chainIDs.add(point?.chain ?? ""),
                        new Set(),
                    ),
                ];

                // Do not suggest moves that do not capture anything and let your opponent immediately capture
                if (newLibertyCount <= 2 && enemyChainLibertyCount > 2) {
                    return;
                }

                // If a neighboring enemy chain has only one liberty, the current move suggestion will capture
                if (enemyChainLibertyCount <= 1) {
                    captureMoves.push({
                        point: move,
                        oldLibertyCount: enemyChainLibertyCount,
                        newLibertyCount: enemyChainLibertyCount - 1,
                    });
                }
                // If the move puts the enemy chain in threat of capture
                else if (
                    enemyChainLibertyCount === 2 &&
                    (newLibertyCount >= 2 || (enemyLibertyGroups.length === 1 && weakestEnemyChainLength > 3) || !smart)
                ) {
                    atariMoves.push({
                        point: move,
                        oldLibertyCount: enemyChainLibertyCount,
                        newLibertyCount: enemyChainLibertyCount - 1,
                    });
                }
                // If the move will not immediately get re-captured, and limits the opponent's liberties
                else if (newLibertyCount >= 2) {
                    surroundMoves.push({
                        point: move,
                        oldLibertyCount: enemyChainLibertyCount,
                        newLibertyCount: enemyChainLibertyCount - 1,
                    });
                }
            });

            return [...captureMoves, ...atariMoves, ...surroundMoves][0];
        }

        // Port of getDefendMove function
        getDefendMove(board, player, availableSpaces) {
            const growthMoves = this.getLibertyGrowthMoves(board, player, availableSpaces);
            const libertyIncreases =
                growthMoves?.filter(
                    (move) => move.oldLibertyCount <= 1 && move.newLibertyCount > move.oldLibertyCount,
                ) ?? [];

            const maxLibertyCount = Math.max(...libertyIncreases.map((l) => l.newLibertyCount - l.oldLibertyCount));

            if (maxLibertyCount < 1) {
                return null;
            }

            const moveCandidates = libertyIncreases.filter(
                (l) => l.newLibertyCount - l.oldLibertyCount === maxLibertyCount,
            );
            return moveCandidates[Math.floor(Math.random() * moveCandidates.length)];
        }

        // Port of getGrowthMove function
        getGrowthMove(board, player, availableSpaces, rng) {
            const growthMoves = this.getLibertyGrowthMoves(board, player, availableSpaces);
            const maxLibertyCount = Math.max(...growthMoves.map((l) => l.newLibertyCount - l.oldLibertyCount));
            const moveCandidates = growthMoves.filter((l) => l.newLibertyCount - l.oldLibertyCount === maxLibertyCount);
            return moveCandidates[Math.floor(rng * moveCandidates.length)];
        }

        // Port of getLibertyGrowthMoves function
        getLibertyGrowthMoves(board, player, availableSpaces) {
            const friendlyChains = this.getAllChains(board).filter((chain) => chain[0].color === player);

            if (!friendlyChains.length) {
                return [];
            }

            // Get all liberties of friendly chains as potential growth move options
            const liberties = friendlyChains
                .map((chain) =>
                    chain[0].liberties
                        ?.filter((lib) => lib != null)
                        .map((liberty) => ({
                            libertyPoint: liberty,
                            oldLibertyCount: chain[0].liberties?.length,
                        })),
                )
                .flat()
                .filter((lib) => lib != null)
                .filter((liberty) =>
                    availableSpaces.find(
                        (point) => liberty.libertyPoint.x === point.x && liberty.libertyPoint.y === point.y,
                    ),
                );

            // Find a liberty where playing a piece increases the liberty of the chain
            return liberties
                .map((liberty) => {
                    const move = liberty.libertyPoint;
                    const newLibertyCount = this.findEffectiveLibertiesOfNewMove(board, move.x, move.y, player).length;
                    const oldLibertyCount = this.findMinLibertyCountOfAdjacentChains(board, move.x, move.y, player);

                    return {
                        point: move,
                        oldLibertyCount: oldLibertyCount,
                        newLibertyCount: newLibertyCount,
                    };
                })
                .filter((move) => move.newLibertyCount > 1 && move.newLibertyCount >= move.oldLibertyCount);
        }

        // Port of getCornerMove function
        getCornerMove(board) {
            const boardEdge = board[0].length - 1;
            const cornerMax = boardEdge - 2;

            if (this.isCornerAvailableForMove(board, cornerMax, cornerMax, boardEdge, boardEdge)) {
                return { x: cornerMax, y: cornerMax };
            }
            if (this.isCornerAvailableForMove(board, 0, cornerMax, 2, boardEdge)) {
                return { x: 2, y: cornerMax };
            }
            if (this.isCornerAvailableForMove(board, 0, 0, 2, 2)) {
                return { x: 2, y: 2 };
            }
            if (this.isCornerAvailableForMove(board, cornerMax, 0, boardEdge, 2)) {
                return { x: cornerMax, y: 2 };
            }
            return null;
        }

        isCornerAvailableForMove(board, x1, y1, x2, y2) {
            const foundPoints = this.findLiveNodesInArea(board, x1, y1, x2, y2);
            const foundPieces = foundPoints.filter((point) => point.color !== this.GoColor.empty);
            return foundPoints.length >= 7 ? foundPieces.length === 0 : false;
        }

        findLiveNodesInArea(board, x1, y1, x2, y2) {
            const foundPoints = [];
            for (let y = 0; y < board.length; y++) {
                for (let x = 0; x < board[y].length; x++) {
                    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                        foundPoints.push({ x: x, y: y, color: board[y][x] });
                    }
                }
            }
            return foundPoints;
        }

        // Port of getExpansionMove function
        getExpansionMove(board, availableSpaces, rng) {
            const moveOptions = this.getExpansionMoveArray(board, availableSpaces);
            const randomIndex = Math.floor(rng * moveOptions.length);
            return moveOptions[randomIndex];
        }

        getExpansionMoveArray(board, availableSpaces) {
            // Look for empty spaces fully surrounded by empty spaces
            const emptySpaces = availableSpaces.filter((space) => {
                const neighbors = this.findNeighbors(board, space.x, space.y);
                return (
                    [neighbors.north, neighbors.east, neighbors.south, neighbors.west].filter(
                        (point) => point && point.color === this.GoColor.empty,
                    ).length === 4
                );
            });

            const disputedSpaces = emptySpaces.length ? [] : this.getDisputedTerritoryMoves(board, availableSpaces, 1);
            const moveOptions = [...emptySpaces, ...disputedSpaces];

            return moveOptions.map((point) => ({
                point: point,
                newLibertyCount: -1,
                oldLibertyCount: -1,
            }));
        }

        getDisputedTerritoryMoves(board, availableSpaces, maxChainSize = 99) {
            const chains = this.getAllChains(board).filter((chain) => chain.length <= maxChainSize);

            return availableSpaces.filter((space) => {
                const chain = chains.find((chain) => chain[0].chain === space.chain) ?? [];
                const playerNeighbors = this.getAllNeighboringChains(board, chain, chains);
                const hasWhitePieceNeighbor = playerNeighbors.find((neighborChain) => neighborChain[0]?.color === "O");
                const hasBlackPieceNeighbor = playerNeighbors.find((neighborChain) => neighborChain[0]?.color === "X");

                return hasWhitePieceNeighbor && hasBlackPieceNeighbor;
            });
        }

        // Port of getJumpMove function
        getJumpMove(board, player, availableSpaces, rng) {
            const moveOptions = this.getExpansionMoveArray(board, availableSpaces).filter(({ point }) =>
                [
                    board[point.y + 2]?.[point.x],
                    board[point.y]?.[point.x + 2],
                    board[point.y - 2]?.[point.x],
                    board[point.y]?.[point.x - 2],
                ].some((cell) => cell === player),
            );

            const randomIndex = Math.floor(rng * moveOptions.length);
            return moveOptions[randomIndex];
        }

        // Simplified eye creation - will need more work for full implementation
        getEyeCreationMove(board, player, availableSpaces) {
            // Simplified eye detection
            for (const space of availableSpaces) {
                if (this.wouldCreateEye(board, space.x, space.y, player)) {
                    return { point: space };
                }
            }
            return null;
        }

        wouldCreateEye(board, x, y, player) {
            const neighbors = this.findNeighbors(board, x, y);
            const neighborhood = [neighbors.north, neighbors.east, neighbors.south, neighbors.west];
            const friendlyCount = neighborhood.filter((point) => !point || point?.color === player).length;
            return friendlyCount >= 3;
        }

        // Simplified eye blocking
        getEyeBlockingMove(board, player, availableSpaces) {
            const opponent = player === "X" ? "O" : "X";
            for (const space of availableSpaces) {
                if (this.wouldCreateEye(board, space.x, space.y, opponent)) {
                    return { point: space };
                }
            }
            return null;
        }

        // Simplified pattern matching
        async findPatternMove(board, player, availableSpaces, smart, rng) {
            // Very basic pattern - look for hane moves
            for (const space of availableSpaces) {
                if (this.isHaneMove(board, space.x, space.y, player)) {
                    return space;
                }
            }
            return null;
        }

        isHaneMove(board, x, y, player) {
            const opponent = player === "X" ? "O" : "X";
            const neighbors = this.findNeighbors(board, x, y);
            const hasOpponent = [neighbors.north, neighbors.east, neighbors.south, neighbors.west].some(
                (point) => point?.color === opponent,
            );
            const hasFriendly = [neighbors.north, neighbors.east, neighbors.south, neighbors.west].some(
                (point) => point?.color === player,
            );
            return hasOpponent && hasFriendly;
        }

        // Helper functions
        findNeighbors(board, x, y) {
            return {
                north: y > 0 ? { x: x, y: y - 1, color: board[y - 1][x] } : null,
                east: x < board[0].length - 1 ? { x: x + 1, y: y, color: board[y][x + 1] } : null,
                south: y < board.length - 1 ? { x: x, y: y + 1, color: board[y + 1][x] } : null,
                west: x > 0 ? { x: x - 1, y: y, color: board[y][x - 1] } : null,
            };
        }

        getAllChains(board) {
            const chains = [];
            const visited = new Set();

            for (let y = 0; y < board.length; y++) {
                for (let x = 0; x < board[y].length; x++) {
                    const key = `${x},${y}`;
                    if (visited.has(key) || board[y][x] === this.GoColor.empty) continue;

                    const chain = this.getChain(board, x, y, visited);
                    if (chain.length > 0) {
                        chains.push(chain);
                    }
                }
            }

            return chains;
        }

        getChain(board, startX, startY, globalVisited) {
            const color = board[startY][startX];
            const chain = [];
            const visited = new Set();
            const stack = [[startX, startY]];

            while (stack.length > 0) {
                const [x, y] = stack.pop();
                const key = `${x},${y}`;

                if (visited.has(key) || globalVisited.has(key)) continue;
                if (board[y][x] !== color) continue;

                visited.add(key);
                globalVisited.add(key);

                const liberties = this.findLiberties(board, x, y);
                const chainId = `chain_${startX}_${startY}`;

                chain.push({
                    x: x,
                    y: y,
                    color: color,
                    liberties: liberties,
                    chain: chainId,
                });

                // Add neighbors to stack
                const directions = [
                    [0, 1],
                    [1, 0],
                    [0, -1],
                    [-1, 0],
                ];
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (this.isValidCoord(nx, ny, board) && !visited.has(`${nx},${ny}`) && board[ny][nx] === color) {
                        stack.push([nx, ny]);
                    }
                }
            }

            return chain;
        }

        findLiberties(board, x, y) {
            const liberties = [];
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];

            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.isValidCoord(nx, ny, board) && board[ny][nx] === this.GoColor.empty) {
                    liberties.push({ x: nx, y: ny, color: this.GoColor.empty });
                }
            }

            return liberties;
        }

        isValidCoord(x, y, board) {
            return x >= 0 && x < board[0].length && y >= 0 && y < board.length;
        }

        findEffectiveLibertiesOfNewMove(board, x, y, player) {
            // Simplified version - just count adjacent empty spaces
            const liberties = [];
            const directions = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];

            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.isValidCoord(nx, ny, board) && board[ny][nx] === this.GoColor.empty) {
                    liberties.push({ x: nx, y: ny });
                }
            }

            return liberties;
        }

        findMinLibertyCountOfAdjacentChains(board, x, y, player) {
            const chains = this.getAllChains(board);
            const neighbors = this.findNeighbors(board, x, y);
            const friendlyNeighbors = [neighbors.north, neighbors.east, neighbors.south, neighbors.west]
                .filter((neighbor) => neighbor != null)
                .filter((neighbor) => neighbor.color === player);

            if (friendlyNeighbors.length === 0) return 99;

            const minimumLiberties = friendlyNeighbors.reduce((min, neighbor) => {
                const chain = chains.find((c) => c.some((point) => point.x === neighbor.x && point.y === neighbor.y));
                const libertyCount = chain?.[0]?.liberties?.length ?? 99;
                return Math.min(min, libertyCount);
            }, 99);

            return minimumLiberties;
        }

        findEnemyNeighborChainWithFewestLiberties(board, x, y, enemyColor) {
            const chains = this.getAllChains(board);
            const neighbors = this.findNeighbors(board, x, y);
            const enemyNeighbors = [neighbors.north, neighbors.east, neighbors.south, neighbors.west]
                .filter((neighbor) => neighbor != null)
                .filter((neighbor) => neighbor.color === enemyColor);

            if (enemyNeighbors.length === 0) return null;

            let minLiberties = 99;
            let weakestChain = null;

            for (const neighbor of enemyNeighbors) {
                const chain = chains.find((c) => c.some((point) => point.x === neighbor.x && point.y === neighbor.y));
                if (chain) {
                    const libertyCount = chain[0]?.liberties?.length ?? 99;
                    if (libertyCount < minLiberties) {
                        minLiberties = libertyCount;
                        weakestChain = chain;
                    }
                }
            }

            return weakestChain;
        }

        getAllNeighboringChains(board, chain, allChains) {
            // Simplified - return empty array for now
            return [];
        }
    }

    // Main game loop
    let gameCount = 0;
    let result;

    do {
        gameCount++;
        const ai = new IlluminatiGoAI(ns);

        ns.print("=== Illuminati AI Analysis ===");

        const startTime = Date.now();
        const bestMove = await ai.selectMove();
        const thinkTime = Date.now() - startTime;

        if (!bestMove) {
            ns.print("Illuminati AI couldn't find a move, passing turn");
            result = await ns.go.passTurn();
        } else {
            const [row, col] = bestMove;
            ns.print(`Illuminati AI selected move: [${row}, ${col}] (analyzed in ${thinkTime}ms)`);

            result = await ns.go.makeMove(row, col);

            if (result?.type === "invalid") {
                ns.print(`Invalid move attempted: [${row}, ${col}], passing instead`);
                result = await ns.go.passTurn();
            } else {
                ns.print(`Move executed successfully: [${row}, ${col}]`);
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
    ns.exec("techLord/master/ipvgo-illuminati-ai.js", "home", 1, ...opponents);
}
