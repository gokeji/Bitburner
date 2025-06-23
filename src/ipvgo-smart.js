/**Author:
 * Discord:
 * - Sphyxis
 *
 * Additional Contributers:
 * Discord:
 * - Stoneware
 * - gmcew
 *
 * Compressed all into main to allow you to run 2 side by side as white and black
 * /

/** @param {NS} ns */
export async function main(ns) {
    ns.ui.openTail();
    ns.disableLog("go.cheat.getCheatSuccessChance");
    const CHEATS = true;
    const LOGTIME = false;
    let STYLE = 0;
    const REPEAT = true;
    let currentValidMovesTurn = 0; //The turn count that the currentValidMoves is valid for
    let currentValidMoves; //All valid moves for this turn
    let currentValidContestedMoves; //All valid moves that occupy a contested space
    let turn = 0;
    let board;
    let contested;
    let validMove;
    let validLibMoves;
    let chains;
    let testBoard = [];

    //Run it with no arguments or the argument "false" to play as black.
    //Run it with any other argument to play as white
    const playAsWhite = false; //!!ns.args[1];
    const opponents = ns.args || ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];
    ns.print("Playing as ", playAsWhite ? "White" : "Black");
    const me = playAsWhite ? "O" : "X";
    const you = me === "X" ? "O" : "X";
    ns.disableLog("disableLog");
    ns.disableLog("go.makeMove");
    ns.disableLog("go.passTurn");
    ns.disableLog("sleep");
    const startBoard = ns.go.getBoardState();
    let inProgress = false;
    let START = performance.now();
    //If we have already moved, jump the turn to 3 to get out of Opening Moves
    for (let x = 0; x < startBoard[0].length; x++) {
        for (let y = 0; y < startBoard[0].length; y++) {
            if (startBoard[x][y] === me) {
                inProgress = true;
                turn = 3;
                break;
            }
        }
        if (inProgress) break;
    }
    getStyle();
    const currentGame = await ns.go.opponentNextTurn(false, playAsWhite);
    checkNewGame(currentGame, false);
    while (true) {
        await ns.sleep(4);
        let passed = false;
        turn++;
        board = ns.go.getBoardState();
        contested = ns.go.analysis.getControlledEmptyNodes();
        validMove = ns.go.analysis.getValidMoves(undefined, undefined, playAsWhite);
        validLibMoves = ns.go.analysis.getLiberties();
        chains = ns.go.analysis.getChains();
        const size = board[0].length;
        //Build a test board with walls
        testBoard = [];
        let testWall = "";
        let results;
        if (size === 13) testWall = "WWWWWWWWWWWWWWW";
        else if (size === 9) testWall = "WWWWWWWWWWW";
        else if (size === 7) testWall = "WWWWWWWWW";
        else if (size === 19) testWall = "WWWWWWWWWWWWWWWWWWWWW";
        else testWall = "WWWWWWW";
        testBoard.push(testWall);
        for (const b of board) testBoard.push("W" + b + "W");
        testBoard.push(testWall);
        //We have our test board

        if (turn <= 1) results = await movePiece(getOpeningMove());
        else {
            switch (STYLE) {
                case 0: //Netburners
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 3, 3, 1, 6)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(getAggroAttack(4, 7, 3, 1, 6)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getDefAttack(8, 20, 2)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false, 1)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
                case 1: //The Black Hand
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 3, 3, 1, 6)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(getAggroAttack(4, 7, 3, 1, 6)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false, 1)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
                case 2: //Mr. Mustacio - Slum Snakes
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 3, 3, 1, 6)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(getDefAttack(4, 7, 3, 1, 6)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false, 1)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
                case 3: //Daedalus
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 4, 3, 1, 6)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(getDefAttack(5, 7, 3, 2, 6)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false, 1)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
                case 4: //Tetrads
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 4, 3)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(getAggroAttack(5, 7, 3)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
                case 5: //Illum
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 4, 3)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
                case 6: //??????
                    if ((results = await movePiece(getRandomCounterLib()))) break;
                    if ((results = await movePiece(getRandomLibAttack(88)))) break;
                    if ((results = await movePiece(getRandomLibDefend()))) break;
                    if ((results = await moveSnakeEyes(getSnakeEyes(6)))) break;
                    if ((results = await movePiece(getAggroAttack(2, 2, 2)))) break;
                    if ((results = await movePiece(disruptEyes()))) break;
                    if ((results = await movePiece(getDefPattern()))) break;
                    if ((results = await movePiece(getAggroAttack(3, 4, 3)))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1)))) break;
                    if ((results = await movePiece(getDefAttack(5, 7, 3)))) break;
                    if ((results = await movePiece(attackGrowDragon(1)))) break;
                    if ((results = await movePiece(getRandomExpand()))) break;
                    if ((results = await movePiece(getRandomBolster(2, 1, false)))) break;
                    if ((results = await movePiece(getRandomLibAttack()))) break;
                    if ((results = await movePiece(getRandomStrat()))) break;
                    ns.print("Turn Passed");
                    passed = true;
                    results = await ns.go.passTurn(playAsWhite);
                    break;
            } //End of style switch
        } // end of turn >= 3
        checkNewGame(results, passed);
    }
    function getStyle() {
        const facing = ns.go.getOpponent();
        switch (facing) {
            case "Netburners":
                STYLE = 0;
                break;
            case "The Black Hand":
                STYLE = 1;
                break;
            case "Slum Snakes":
                STYLE = 2;
                break;
            case "Daedalus":
                STYLE = 3;
                break;
            case "Tetrads":
                STYLE = 4;
                break;
            case "Illuminati":
                STYLE = 5;
                break;
            default:
                STYLE = 6;
        }
    }

    function checkNewGame(gameInfo, passed) {
        if (gameInfo.type === "gameOver" || (gameInfo.type === "pass" && passed)) {
            if (!REPEAT) ns.exit();
            if (playAsWhite) ns.go.resetBoardState("No AI", 13);
            else if (ns.go.getOpponent() === "No AI") ns.go.resetBoardState("No AI", 13);
            else {
                try {
                    ns.go.resetBoardState(opponents[Math.floor(Math.random() * opponents.length)], 13);
                } catch {
                    ns.go.resetBoardState(opponents[Math.floor(Math.random() * opponents.length)], 13);
                }
            }
            turn = 0;
            ns.clearLog();
            getStyle();
        }
    }
    function isPattern(x, y, pattern) {
        //Move the pattern around with x/y loops, check if pattern matches IF a move is placed
        //We can assume that x and y are valid moves

        const size = testBoard[0].length;
        const patterns = getAllPatterns(pattern);
        const patternSize = pattern.length;

        for (const patternCheck of patterns) {
            //cx and cy - the spots of the pattern we are checking against the test board
            //For, say a 3x3 pattern, we do a grid of 0,0 -> 2, 2
            for (let cx = (patternSize - 1) * -1; cx <= 0; cx++) {
                // We've added a wall around everything, so 0 is a wall
                if (cx + x + 1 < 0 || cx + x + 1 > size - 1) continue;
                for (let cy = (patternSize - 1) * -1; cy <= 0 - 1; cy++) {
                    //We now have a cycle that will check each section of the grid against the pattern
                    //Safety checks: We know 0,0 is safe, we were sent it, but each other section could be bad
                    if (cy + y + 1 < 0 || cy + y + 1 > size - 1) continue;
                    let count = 0;
                    let abort = false;
                    for (let px = 0; px < patternSize && !abort; px++) {
                        if (x + cx + px + 1 < 0 || x + cx + px + 1 >= size) {
                            //Don't go off grid
                            abort = true;
                            break;
                        }
                        for (let py = 0; py < patternSize && !abort; py++) {
                            if (y + cy + py + 1 < 0 || y + cy + py + 1 >= size) {
                                //Are we off the map?
                                abort = true;
                                break;
                            }
                            if (cx + px === 0 && cy + py === 0 && ![me, "*"].includes(patternCheck[px][py])) {
                                abort = true;
                                break;
                            }
                            if (
                                cx + px === 0 &&
                                cy + py === 0 &&
                                [me].includes(contested[x][y]) &&
                                patternCheck[px][py] !== "*"
                            ) {
                                abort = true;
                                break;
                            }
                            //We now have a cycles for each spot in the pattern
                            //0,0 -> 2,2 for a 3x3
                            switch (patternCheck[px][py]) {
                                case "X":
                                    if (
                                        testBoard[cx + x + 1 + px][cy + y + 1 + py] === me ||
                                        (cx + px === 0 &&
                                            cy + py === 0 &&
                                            testBoard[cx + x + 1 + px][cy + y + 1 + py] === ".")
                                    ) {
                                        count++;
                                    } else if (cx + px === 0 && cy + py === 0) {
                                        count++; // Our placement piece
                                    } else abort = true;
                                    break;
                                case "*": // Special case.  We move here next or break the test
                                    if (
                                        testBoard[cx + x + 1 + px][cy + y + 1 + py] === "." &&
                                        cx + px === 0 &&
                                        cy + py === 0
                                    ) {
                                        count++;
                                    } else abort = true;
                                    break;
                                case "O":
                                    if (testBoard[cx + x + 1 + px][cy + y + 1 + py] === you) count++;
                                    else abort = true;
                                    break;
                                case "x":
                                    if ([me, "."].includes(testBoard[cx + x + 1 + px][cy + y + 1 + py])) count++;
                                    else abort = true;
                                    break;
                                case "o":
                                    if ([you, "."].includes(testBoard[cx + x + 1 + px][cy + y + 1 + py])) count++;
                                    else abort = true;
                                    break;
                                case "?":
                                    count++;
                                    break;
                                case ".":
                                    if (testBoard[cx + x + 1 + px][cy + y + 1 + py] === ".") count++;
                                    else abort = true;
                                    break;
                                case "W":
                                    if (["W", "#"].includes(testBoard[cx + x + 1 + px][cy + y + 1 + py])) count++;
                                    else abort = true;
                                    break;
                                case "B":
                                    if (["W", "#", me].includes(testBoard[cx + x + 1 + px][cy + y + 1 + py])) count++;
                                    else abort = true;
                                    break;
                                case "b":
                                    if (["W", "#", you].includes(testBoard[cx + x + 1 + px][cy + y + 1 + py])) count++;
                                    else abort = true;
                                    break;
                                case "A":
                                    if (["W", "#", me, you].includes(testBoard[cx + x + 1 + px][cy + y + 1 + py]))
                                        count++;
                                    else abort = true;
                                    break;
                            }
                            if (count === patternSize * patternSize) return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    function getAllPatterns(pattern) {
        const rotations = [
            pattern,
            rotate90Degrees(pattern),
            rotate90Degrees(rotate90Degrees(pattern)),
            rotate90Degrees(rotate90Degrees(rotate90Degrees(pattern))),
        ];
        return [...rotations, ...rotations.map(verticalMirror)];
    }
    //Special thanks to @gmcew for the next 2 functions!
    function rotate90Degrees(pattern) {
        return pattern.map((val, index) =>
            pattern
                .map((row) => row[index])
                .reverse()
                .join(""),
        );
    }
    function verticalMirror(pattern) {
        return pattern.toReversed();
    }
    function getSnakeEyes(minKilled = 6) {
        if (!CHEATS) return [];
        const moveOptions = [];
        const size = board[0].length;
        let highValue = 1;

        const checked = new Set();

        for (let x = 0; x < size - 1; x++)
            for (let y = 0; y < size - 1; y++) {
                if (
                    contested[x][y] === me ||
                    board[x][y] !== you ||
                    validLibMoves[x][y] !== 2 ||
                    checked.has(JSON.stringify([x, y]))
                )
                    continue;
                //Is it the enemy, with 2 libs (we can kill) and we have not checked this spot and the chain is large enough
                const chain = getChainValue(x, y, you);
                checked.add(JSON.stringify([x, y]));
                if (chain < minKilled) continue;
                //We have a winner!  Check all it's spots and find the 2 killing blows.  Add the checked spots to the checked list so we don't recheck

                const enemySearch = new Set();
                const move1 = [];
                const move2 = [];
                enemySearch.add(JSON.stringify([x, y]));
                for (const explore of enemySearch) {
                    const [fx, fy] = JSON.parse(explore);
                    //Find your eyes
                    if (board[fx][fy] === ".") {
                        move1.length ? move2.push([fx, fy]) : move1.push([fx, fy]);
                        checked.add(JSON.stringify([fx, fy]));
                        continue;
                    }

                    //Find more of yourself to search...
                    if (fx < size - 1 && [you, "."].includes(board[fx + 1][fy])) {
                        enemySearch.add(JSON.stringify([fx + 1, fy]));
                        checked.add(JSON.stringify([fx, fy]));
                    }
                    if (fx > 0 && [you, "."].includes(board[fx - 1][fy])) {
                        enemySearch.add(JSON.stringify([fx - 1, fy]));
                        checked.add(JSON.stringify([fx, fy]));
                    }
                    if (fy > 0 && [you, "."].includes(board[fx][fy - 1])) {
                        enemySearch.add(JSON.stringify([fx, fy - 1]));
                        checked.add(JSON.stringify([fx, fy]));
                    }
                    if (fy < size - 1 && [you, "."].includes(board[fx][fy + 1])) {
                        enemySearch.add(JSON.stringify([fx, fy + 1]));
                        checked.add(JSON.stringify([fx, fy]));
                    }
                } // End of searching the enemy

                if (chain > highValue) {
                    highValue = chain;
                    moveOptions.length = 0;
                    const mv1 = move1.pop();
                    const mv2 = move2.pop();
                    moveOptions.push([mv1[0], mv1[1], mv2[0], mv2[1]]);
                } else if (chain === highValue) {
                    const mv1 = move1.pop();
                    const mv2 = move2.pop();
                    moveOptions.push([mv1[0], mv1[1], mv2[0], mv2[1]]);
                }
            } // Search whole board

        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "SnakeEyes Cheat",
              }
            : [];
    }
    function getRandomLibAttack(minKilled = 1) {
        const moveOptions = [];
        const size = board[0].length;
        let highValue = 1;
        // Look through all the points on the board
        const moves = getAllValidMoves(true);
        for (const [x, y] of moves) {
            if (contested[x][y] === me || validLibMoves[x][y] !== -1) continue;

            let count = 0;
            let chains = 0;

            //We are only checking up, down, left and right
            if (x > 0 && board[x - 1][y] === you && validLibMoves[x - 1][y] === 1) {
                count++;
                chains += getChainValue(x - 1, y, you);
            }
            if (x < size - 1 && board[x + 1][y] === you && validLibMoves[x + 1][y] === 1) {
                count++;
                chains += getChainValue(x + 1, y, you);
            }
            if (y > 0 && board[x][y - 1] === you && validLibMoves[x][y - 1] === 1) {
                count++;
                chains += getChainValue(x, y - 1, you);
            }
            if (y < size - 1 && board[x][y + 1] === you && validLibMoves[x][y + 1] === 1) {
                count++;
                chains += getChainValue(x, y + 1, you);
            }
            const enemyLibs = getSurroundLibs(x, y, you);
            if (count === 0 || (chains < minKilled && enemyLibs <= 1)) continue;

            const result = count * chains;
            if (result > highValue) {
                moveOptions.length = 0;
                moveOptions.push([x, y]);
                highValue = result;
            } else if (result === highValue) moveOptions.push([x, y]);
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Lib Attack",
              }
            : [];
    }
    function getRandomLibDefend(savedMin = 1) {
        const moveOptions = [];
        const size = board[0].length;
        let highValue = 0;
        // Look through all the points on the board
        const moves = getAllValidMoves();
        for (const [x, y] of moves) {
            const surround = getSurroundLibs(x, y, me);
            const myEyes = getEyeValue(x, y, me);
            if (surround + myEyes < 2) continue; //Abort.  Let it go, let it go...

            if (validLibMoves[x][y] === -1) {
                let count = 0;
                //We are only checking up, down, left and right
                if (x > 0 && validLibMoves[x - 1][y] === 1 && board[x - 1][y] === me)
                    count += getChainValue(x - 1, y, me);
                if (x < size - 1 && validLibMoves[x + 1][y] === 1 && board[x + 1][y] === me)
                    count += getChainValue(x + 1, y, me);
                if (y > 0 && validLibMoves[x][y - 1] === 1 && board[x][y - 1] === me)
                    count += getChainValue(x, y - 1, me);
                if (y < size - 1 && validLibMoves[x][y + 1] === 1 && board[x][y + 1] === me)
                    count += getChainValue(x, y + 1, me);
                if (count === 0 || count < savedMin) continue;
                //Just HOW effective will this move be?  Counter attack if we can.
                count *= surround;

                if (count > highValue) {
                    moveOptions.length = 0;
                    moveOptions.push([x, y]);
                    highValue = count;
                } else if (count === highValue) moveOptions.push([x, y]);
            }
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Lib Defend",
              }
            : [];
    }
    function getRandomCounterLib() {
        //Advanced strategy
        //If we have a chain that's going to die, and a hanging lib attached to it
        //Find that hanging lib and kill it to save the chain
        const size = board[0].length;
        // Look through all the points on the board
        const moves = getAllValidMoves();
        const movesAvailable = new Set(); //Contains the empty squares that we are looking to see if we should take
        const friendlyToCheckForOpp = new Set();
        for (const [x, y] of moves) {
            //We are checking up, down, left and right first
            if (x > 0 && validLibMoves[x - 1][y] === 1 && board[x - 1][y] === me) {
                movesAvailable.add(JSON.stringify([x, y]));
                friendlyToCheckForOpp.add(JSON.stringify([x - 1, y]));
            }
            if (x < size - 1 && validLibMoves[x + 1][y] === 1 && board[x + 1][y] === me) {
                movesAvailable.add(JSON.stringify([x, y]));
                friendlyToCheckForOpp.add(JSON.stringify([x + 1, y]));
            }
            if (y > 0 && validLibMoves[x][y - 1] === 1 && board[x][y - 1] === me) {
                movesAvailable.add(JSON.stringify([x, y]));
                friendlyToCheckForOpp.add(JSON.stringify([x, y - 1]));
            }
            if (y < size - 1 && validLibMoves[x][y + 1] === 1 && board[x][y + 1] === me) {
                movesAvailable.add(JSON.stringify([x, y]));
                friendlyToCheckForOpp.add(JSON.stringify([x, y + 1]));
            }
        }
        //Shortcut.  While there's 1, is it THE one?
        //We know that 1 side of this is a friendly with 1 lib at risk.  Is another side the enemy?
        for (const explore of movesAvailable) {
            const [fx, fy] = JSON.parse(explore);
            if (!validMove[fx][fy]) continue;
            if (fx < size - 1 && board[fx + 1][fy] === you && validLibMoves[fx + 1][fy] === 1) {
                return {
                    coords: [fx, fy],
                    msg: "Counter Lib Attack - Fist of the east",
                };
            }
            if (fx > 0 && board[fx - 1][fy] === you && validLibMoves[fx - 1][fy] === 1) {
                return {
                    coords: [fx, fy],
                    msg: "Counter Lib Attack - Fist of the west",
                };
            }
            if (fy > 0 && board[fx][fy - 1] === you && validLibMoves[fx][fy - 1] === 1) {
                return {
                    coords: [fx, fy],
                    msg: "Counter Lib Attack - Fist of the south",
                };
            }
            if (fy < size - 1 && board[fx][fy + 1] === you && validLibMoves[fx][fy + 1] === 1) {
                return {
                    coords: [fx, fy],
                    msg: "Counter Lib Attack - Fist of the north",
                };
            }
        }
        const enemiesToSearch = new Set();
        //We have our empty chain.  Look through him to find adjoining O's that can be killed and other friendies
        for (const explore of friendlyToCheckForOpp) {
            const [fx, fy] = JSON.parse(explore);
            if (fx < size - 1 && board[fx + 1][fy] === you && validLibMoves[fx + 1][fy] === 1)
                enemiesToSearch.add(JSON.stringify([fx + 1, fy]));
            if (fx > 0 && board[fx - 1][fy] === you && validLibMoves[fx - 1][fy] === 1)
                enemiesToSearch.add(JSON.stringify([fx - 1, fy]));
            if (fy > 0 && board[fx][fy - 1] === you && validLibMoves[fx][fy - 1] === 1)
                enemiesToSearch.add(JSON.stringify([fx, fy - 1]));
            if (fy < size - 1 && board[fx][fy + 1] === you && validLibMoves[fx][fy + 1] === 1)
                enemiesToSearch.add(JSON.stringify([fx, fy + 1]));

            if (fx < size - 1 && [me].includes(board[fx + 1][fy]))
                friendlyToCheckForOpp.add(JSON.stringify([fx + 1, fy]));
            if (fx > 0 && [me].includes(board[fx - 1][fy])) friendlyToCheckForOpp.add(JSON.stringify([fx - 1, fy]));
            if (fy > 0 && [me].includes(board[fx][fy - 1])) friendlyToCheckForOpp.add(JSON.stringify([fx, fy - 1]));
            if (fy < size - 1 && [me].includes(board[fx][fy + 1]))
                friendlyToCheckForOpp.add(JSON.stringify([fx, fy + 1]));
        }

        for (const explore of enemiesToSearch) {
            const [fx, fy] = JSON.parse(explore);
            if (fx < size - 1 && board[fx + 1][fy] === you) enemiesToSearch.add(JSON.stringify([fx + 1, fy]));
            if (fx > 0 && board[fx - 1][fy] === you) enemiesToSearch.add(JSON.stringify([fx - 1, fy]));
            if (fy > 0 && board[fx][fy - 1] === you) enemiesToSearch.add(JSON.stringify([fx, fy - 1]));
            if (fy < size - 1 && board[fx][fy + 1] === you) enemiesToSearch.add(JSON.stringify([fx, fy + 1]));

            if (fx < size - 1 && board[fx + 1][fy] === "." && validMove[fx + 1][fy]) {
                return {
                    coords: [fx + 1, fy],
                    msg: "Counter Lib Attack - The wind blows",
                };
            }
            if (fx > 0 && board[fx - 1][fy] === "." && validMove[fx - 1][fy]) {
                return {
                    coords: [fx - 1, fy],
                    msg: "Counter Lib Attack - The earth grows",
                };
            }
            if (fy > 0 && board[fx][fy - 1] === "." && validMove[fx][fy - 1]) {
                return {
                    coords: [fx, fy - 1],
                    msg: "Counter Lib Attack - The fire burns",
                };
            }
            if (fy < size - 1 && board[fx][fy + 1] === "." && validMove[fx][fy + 1]) {
                return {
                    coords: [fx, fy + 1],
                    msg: "Counter Lib Attack - The water flows",
                };
            }
        }
        return [];
    }
    function getRandomExpand() {
        const moveOptions = [];
        const size = board[0].length;
        let highValue = 0;
        // Look through all the points on the board
        const moves = getAllValidMoves(true);
        for (const [x, y] of moves) {
            const surroundLibs = getSurroundLibs(x, y, me);
            const enemySurroundLibs = getSurroundLibs(x, y, you);
            if (contested[x][y] !== "?" || surroundLibs <= 2 || createsLib(x, y, me) || enemySurroundLibs <= 1)
                continue;
            let count = 0;
            //We are only checking up, down, left and right.  Don't expand if you're surrounded by friendlies
            if (x > 0 && board[x - 1][y] === me) count++;
            if (x < size - 1 && board[x + 1][y] === me) count++;
            if (y > 0 && board[x][y - 1] === me) count++;
            if (y < size - 1 && board[x][y + 1] === me) count++;
            if (count >= 3 || count <= 0) continue;

            const surroundSpace = getSurroundSpaceFull(x, y) + 1;
            const enemySurroundChains = getChainAttack(x, y) + 1;
            const myEyes = getEyeValueFull(x, y, me) + 1;
            const enemies = getSurroundEnemiesFull(x, y) + 1;
            const freeSpace = getFreeSpace(x, y);
            const rank = myEyes * enemySurroundLibs * enemies * enemySurroundChains * freeSpace * surroundSpace;

            if (rank > highValue) {
                moveOptions.length = 0;
                moveOptions.push([x, y]);
                highValue = rank;
            } else if (rank === highValue) moveOptions.push([x, y]);
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Expansion",
              }
            : [];
    }
    function getRandomBolster(libRequired, savedNodesMin, onlyContested = true) {
        const moveOptions = [];
        const size = board[0].length;
        let highValue = 1;
        // Look through all the points on the board
        const moves = getAllValidMoves();
        for (const [x, y] of moves) {
            if ((onlyContested && contested[x][y] !== "?") || createsLib(x, y, me)) continue;
            let right = 0;
            let left = 0;
            let up = 0;
            let down = 0;

            //We are only checking up, down, left and right
            //We are checking for linking chains of friendlies, filtering out those already checked
            let checkedChains = [];
            if (x < size - 1 && board[x + 1][y] === me && validLibMoves[x + 1][y] === libRequired) {
                right = getChainValue(x + 1, y, me);
                checkedChains.push(chains[x + 1][y]);
            }
            if (
                x > 0 &&
                board[x - 1][y] === me &&
                !checkedChains.includes(chains[x - 1][y]) &&
                validLibMoves[x - 1][y] === libRequired
            ) {
                left = getChainValue(x - 1, y, me);
                checkedChains.push(chains[x - 1][y]);
            }
            if (
                y < size - 1 &&
                board[x][y + 1] === me &&
                !checkedChains.includes(chains[x][y + 1]) &&
                validLibMoves[x][y + 1] === libRequired
            ) {
                up = getChainValue(x, y + 1, me);
                checkedChains.push(chains[x][y + 1]);
            }
            if (
                y > 0 &&
                board[x][y - 1] === me &&
                !checkedChains.includes(chains[x][y - 1]) &&
                validLibMoves[x][y - 1] === libRequired
            )
                down = getChainValue(x, y - 1, me);

            let count = 0;
            let total = 0;
            if (right >= savedNodesMin) {
                count++;
                total += right;
            }
            if (left >= savedNodesMin) {
                count++;
                total += left;
            }
            if (up >= savedNodesMin) {
                count++;
                total += up;
            }
            if (down >= savedNodesMin) {
                count++;
                total += down;
            }
            if (count <= 0) continue;
            const surroundMulti = getSurroundLibSpread(x, y, me);
            const rank = total * count * surroundMulti;
            if (rank > highValue) {
                moveOptions.length = 0;
                moveOptions.push([x, y]);
                highValue = rank;
            } else if (rank === highValue) moveOptions.push([x, y]);
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg:
                      "Bolster - Libs: " +
                      libRequired +
                      "  Nodes: " +
                      savedNodesMin +
                      "  OnlyContested: " +
                      onlyContested,
              }
            : [];
    }
    function getChainValue(checkx, checky, player) {
        const size = board[0].length;
        const otherPlayer = player === me ? you : me;
        const explored = new Set();
        if (
            contested[checkx][checky] === "?" ||
            contested[checkx][checky] === "#" ||
            board[checkx][checky] === otherPlayer
        )
            return 0;
        if (checkx < size - 1) explored.add(JSON.stringify([checkx + 1, checky]));
        if (checkx > 0) explored.add(JSON.stringify([checkx - 1, checky]));
        if (checky > 0) explored.add(JSON.stringify([checkx, checky - 1]));
        if (checky < size - 1) explored.add(JSON.stringify([checkx, checky + 1]));
        let count = 1;
        for (const explore of explored) {
            const [x, y] = JSON.parse(explore);
            if (contested[x][y] === "?" || contested[x][y] === "#" || board[x][y] === otherPlayer) continue;
            count++;
            if (x < size - 1) explored.add(JSON.stringify([x + 1, y]));
            if (x > 0) explored.add(JSON.stringify([x - 1, y]));
            if (y > 0) explored.add(JSON.stringify([x, y - 1]));
            if (y < size - 1) explored.add(JSON.stringify([x, y + 1]));
        }
        return count;
    }
    function getEyeValue(checkx, checky, player) {
        const size = board[0].length;
        const otherPlayer = player === me ? you : me;
        const explored = new Set();
        if (checkx < size - 1) explored.add(JSON.stringify([checkx + 1, checky]));
        if (checkx > 0) explored.add(JSON.stringify([checkx - 1, checky]));
        if (checky > 0) explored.add(JSON.stringify([checkx, checky - 1]));
        if (checky < size - 1) explored.add(JSON.stringify([checkx, checky + 1]));
        let count = 0;
        for (const explore of explored) {
            const [x, y] = JSON.parse(explore);
            if (contested[x][y] === "?" || contested[x][y] === "#" || board[x][y] === otherPlayer) continue;
            if (contested[x][y] === player) count++;
            if (x < size - 1) explored.add(JSON.stringify([x + 1, y]));
            if (x > 0) explored.add(JSON.stringify([x - 1, y]));
            if (y > 0) explored.add(JSON.stringify([x, y - 1]));
            if (y < size - 1) explored.add(JSON.stringify([x, y + 1]));
        }
        return count;
    }
    function getFreeSpace(checkx, checky) {
        const size = board[0].length;
        if (contested[checkx][checky] !== "?") return 0;
        const explored = new Set();
        if (checkx < size - 1) explored.add(JSON.stringify([checkx + 1, checky]));
        if (checkx > 0) explored.add(JSON.stringify([checkx - 1, checky]));
        if (checky > 0) explored.add(JSON.stringify([checkx, checky - 1]));
        if (checky < size - 1) explored.add(JSON.stringify([checkx, checky + 1]));
        let count = 1;
        for (const explore of explored) {
            const [x, y] = JSON.parse(explore);
            if (["#", me, you].includes(contested[x][y])) continue;
            if (contested[x][y] === "?") count++;
            if (x < size - 1) explored.add(JSON.stringify([x + 1, y]));
            if (x > 0) explored.add(JSON.stringify([x - 1, y]));
            if (y > 0) explored.add(JSON.stringify([x, y - 1]));
            if (y < size - 1) explored.add(JSON.stringify([x, y + 1]));
        }
        return count;
    }
    function getEyeValueFull(checkx, checky, player) {
        const size = board[0].length;
        const otherPlayer = player === me ? you : me;
        const explored = new Set();
        if (checkx < size - 1) explored.add(JSON.stringify([checkx + 1, checky]));
        if (checkx > 0) explored.add(JSON.stringify([checkx - 1, checky]));
        if (checky > 0) explored.add(JSON.stringify([checkx, checky - 1]));
        if (checky < size - 1) explored.add(JSON.stringify([checkx, checky + 1]));
        if (checkx < size - 1 && checky < size - 1) explored.add(JSON.stringify([checkx + 1, checky + 1]));
        if (checkx > 0 && checky < size - 1) explored.add(JSON.stringify([checkx - 1, checky + 1]));
        if (checkx < size - 1 && checky > 0) explored.add(JSON.stringify([checkx + 1, checky - 1]));
        if (checkx > 0 && checky > 0) explored.add(JSON.stringify([checkx - 1, checky - 1]));
        let count = 0;
        for (const explore of explored) {
            const [x, y] = JSON.parse(explore);
            if (contested[x][y] === "?" || contested[x][y] === "#" || board[x][y] === otherPlayer) continue;
            if (contested[x][y] === player) count++;
            if (x < size - 1) explored.add(JSON.stringify([x + 1, y]));
            if (x > 0) explored.add(JSON.stringify([x - 1, y]));
            if (y > 0) explored.add(JSON.stringify([x, y - 1]));
            if (y < size - 1) explored.add(JSON.stringify([x, y + 1]));
        }
        return count;
    }
    function getChainAttack(x, y) {
        const size = board[0].length;
        let count = 0;
        if (x > 0 && board[x - 1][y] === you) count += getChainValue(x - 1, y, you);
        if (x < size - 1 && board[x + 1][y] === you) count += getChainValue(x + 1, y, you);
        if (y > 0 && board[x][y - 1] === you) count += getChainValue(x, y - 1, you);
        if (y < size - 1 && board[x][y + 1] === you) count += getChainValue(x, y + 1, you);

        return count;
    }
    function getChainAttackFull(x, y) {
        const size = board[0].length;
        let count = 0;
        if (x < size - 1) count += getChainValue(x + 1, y, you);
        if (x > 0) count += getChainValue(x - 1, y, you);
        if (y > 0) count += getChainValue(x, y - 1, you);
        if (y < size - 1) count += getChainValue(x, y + 1, you);
        if (x < size - 1 && y < size - 1) count += getChainValue(x + 1, y + 1, you);
        if (x > 0 && y < size - 1) count += getChainValue(x - 1, y + 1, you);
        if (x < size - 1 && y > 0) count += getChainValue(x + 1, y - 1, you);
        if (x > 0 && y > 0) count += getChainValue(x - 1, y - 1, you);
        return count;
    }
    function getSurroundSpace(x, y) {
        const size = board[0].length;
        let surround = 0;
        if (x > 0 && board[x - 1][y] === ".") surround++;
        if (x < size - 1 && board[x + 1][y] === ".") surround++;
        if (y > 0 && board[x][y - 1] === ".") surround++;
        if (y < size - 1 && board[x][y + 1] === ".") surround++;
        return surround;
    }
    function getSurroundSpaceFull(startx, starty, player = me, depth = 1) {
        const size = board[0].length;
        let surround = 0;
        for (let x = startx - depth; x <= startx + depth; x++)
            for (let y = starty - depth; y <= starty + depth; y++)
                if (x >= 0 && x <= size - 1 && y >= 0 && y <= size - 1 && [".", player].includes(board[x][y]))
                    surround++;
        return surround;
    }
    function getHeatMap(startx, starty, player = me, depth = 2) {
        const size = board[0].length;
        let count = 1;
        for (let x = startx - depth; x <= startx + depth; x++)
            for (let y = starty - depth; y <= starty + depth; y++)
                if (x >= 0 && x <= size - 1 && y >= 0 && y <= size - 1 && [".", player].includes(board[x][y]))
                    count += board[x][y] === player ? 1.5 : board[x][y] === "." ? 1 : 0;
        return count;
    }
    function getSurroundLibs(x, y, player) {
        const size = board[0].length;
        let surround = 0;
        if (x > 0 && (board[x - 1][y] === "." || board[x - 1][y] === player))
            surround += board[x - 1][y] === "." ? 1 : validLibMoves[x - 1][y] - 1;
        if (x < size - 1 && (board[x + 1][y] === "." || board[x + 1][y] === player))
            surround += board[x + 1][y] === "." ? 1 : validLibMoves[x + 1][y] - 1;
        if (y > 0 && (board[x][y - 1] === "." || board[x][y - 1] === player))
            surround += board[x][y - 1] === "." ? 1 : validLibMoves[x][y - 1] - 1;
        if (y < size - 1 && (board[x][y + 1] === "." || board[x][y + 1] === player))
            surround += board[x][y + 1] === "." ? 1 : validLibMoves[x][y + 1] - 1;
        return surround;
    }
    function getSurroundLibSpread(x, y, player) {
        const size = board[0].length;
        let surround = 0;
        const checks = new Set();
        if (board[x][y] === ".") checks.add(JSON.stringify([x, y]));
        else return 0;
        if (x > 0 && board[x - 1][y] === ".") checks.add(JSON.stringify([x - 1, y]));
        if (x < size - 1 && board[x + 1][y] === ".") checks.add(JSON.stringify([x + 1, y]));
        if (y > 0 && board[x][y - 1] === ".") checks.add(JSON.stringify([x, y - 1]));
        if (y < size - 1 && board[x][y + 1] === ".") checks.add(JSON.stringify([x, y + 1]));
        //Now, check the liberty values of all the checks
        for (const check of checks) {
            const [x, y] = JSON.parse(check);
            surround += getSurroundLibs(x, y, player);
        }
        return surround;
    }
    function getSurroundEnemiesFull(x, y) {
        const size = board[0].length;
        let surround = 0;
        if (x > 0 && board[x - 1][y] === you) surround += getChainValue(x - 1, y, you);
        if (x < size - 1 && board[x + 1][y] === you) surround += getChainValue(x + 1, y, you);
        if (y > 0 && board[x][y - 1] === you) surround += getChainValue(x, y - 1, you);
        if (y < size - 1 && board[x][y + 1] === you) surround += getChainValue(x, y + 1, you);

        if (x > 0 && y > 0 && board[x - 1][y - 1] === you) surround += getChainValue(x - 1, y - 1, you);
        if (x < size - 1 && y > 0 && board[x + 1][y - 1] === you) surround += getChainValue(x + 1, y - 1, you);
        if (y < size - 1 && x > 0 && board[x - 1][y + 1] === you) surround += getChainValue(x - 1, y - 1, you);
        if (y < size - 1 && x < size - 1 && board[x + 1][y + 1] === you) surround += getChainValue(x + 1, y + 1, you);

        return surround;
    }
    function getRandomStrat() {
        const moveOptions = [];
        const moveOptions2 = [];
        const size = board[0].length;

        // Look through all the points on the board
        let bestRank = 0;
        const moves = getAllValidMoves(true);
        for (const [x, y] of moves) {
            if (!["?", you].includes(contested[x][y]) || createsLib(x, y, me)) continue;
            let isSupport =
                (x > 0 && board[x - 1][y] === me && validLibMoves[x - 1][y] >= 1) ||
                (x < size - 1 && board[x + 1][y] === me && validLibMoves[x + 1][y] >= 1) ||
                (y > 0 && board[x][y - 1] === me && validLibMoves[x][y - 1] >= 1) ||
                (y < size - 1 && board[x][y + 1] === me && validLibMoves[x][y + 1] >= 1)
                    ? true
                    : false;
            let isAttack =
                (x > 0 && board[x - 1][y] === you && validLibMoves[x - 1][y] >= 2) ||
                (x < size - 1 && board[x + 1][y] === you && validLibMoves[x + 1][y] >= 2) ||
                (y > 0 && board[x][y - 1] === you && validLibMoves[x][y - 1] >= 2) ||
                (y < size - 1 && board[x][y + 1] === you && validLibMoves[x][y + 1] >= 2)
                    ? true
                    : false;

            const surround = getSurroundSpace(x, y);
            if (isSupport || isAttack) {
                if (surround > bestRank) {
                    moveOptions.length = 0;
                    bestRank = surround;
                    moveOptions.push([x, y]);
                } else if (surround === bestRank) {
                    moveOptions.push([x, y]);
                }
            } else {
                moveOptions2.push([x, y]);
            }
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        const randomIndex2 = Math.floor(Math.random() * moveOptions2.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Random Safe",
              }
            : moveOptions2[randomIndex2]
              ? {
                    coords: moveOptions2[randomIndex2],
                    msg: "Random Unsafe",
                }
              : [];
    }
    function getAggroAttack(libsMin, libsMax, minSurround = 3, minChain = 1, minFreeSpace = 0) {
        const moveOptions = [];
        const size = board[0].length;
        let highestValue = 0;
        // Look through all the points on the board
        const moves = getAllValidMoves(true);
        for (const [x, y] of moves) {
            if (createsLib(x, y, me)) continue;
            const isAttack =
                (x > 0 &&
                    board[x - 1][y] === you &&
                    validLibMoves[x - 1][y] >= libsMin &&
                    validLibMoves[x - 1][y] <= libsMax) ||
                (x < size - 1 &&
                    board[x + 1][y] === you &&
                    validLibMoves[x + 1][y] >= libsMin &&
                    validLibMoves[x + 1][y] <= libsMax) ||
                (y > 0 &&
                    board[x][y - 1] === you &&
                    validLibMoves[x][y - 1] >= libsMin &&
                    validLibMoves[x][y - 1] <= libsMax) ||
                (y < size - 1 &&
                    board[x][y + 1] === you &&
                    validLibMoves[x][y + 1] >= libsMin &&
                    validLibMoves <= libsMax)
                    ? true
                    : false;
            const surround = getSurroundLibs(x, y, me);
            const freeSpace = getFreeSpace(x, y);
            if (freeSpace < minFreeSpace) continue;
            if (!isAttack || surround < minSurround) continue;
            const chainAtk = getChainAttack(x, y);
            if (chainAtk < minChain) continue;
            let lowestLibs = 999;
            if (x > 0 && board[x - 1][y] === you && validLibMoves[x - 1][y] < lowestLibs)
                lowestLibs = validLibMoves[x - 1][y];
            if (x < size - 1 && board[x + 1][y] === you && validLibMoves[x + 1][y] < lowestLibs)
                lowestLibs = validLibMoves[x + 1][y];
            if (y > 0 && board[x][y - 1] === you && validLibMoves[x][y - 1] < lowestLibs)
                lowestLibs = validLibMoves[x][y - 1];
            if (y < size - 1 && board[x][y + 1] === you && validLibMoves[x][y + 1] < lowestLibs)
                lowestLibs = validLibMoves[x][y + 1];

            const enemyLibs = getSurroundLibSpread(x, y, you);
            const startEyeValue = getEyeValue(x, y, you);
            const eyeValue = startEyeValue > 1 ? startEyeValue : 1;
            const atk = (enemyLibs * chainAtk) / eyeValue / lowestLibs;
            if (atk > highestValue) {
                highestValue = atk;
                moveOptions.length = 0;
                moveOptions.push([x, y]);
            } else if (atk === highestValue) {
                highestValue = atk;
                moveOptions.push([x, y]);
            }
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Aggro Attack: " + libsMin + "/" + libsMax + "  Surround: " + minSurround,
              }
            : [];
    }
    function getDefAttack(libsMin, libsMax, minSurround = 3, minChain = 1, minFreeSpace = 0) {
        const moveOptions = [];
        const size = board[0].length;
        let highestValue = 0;
        // Look through all the points on the board
        const moves = getAllValidMoves(true);
        for (const [x, y] of moves) {
            if (createsLib(x, y, me)) continue;
            const isAttack =
                (x > 0 &&
                    board[x - 1][y] === you &&
                    validLibMoves[x - 1][y] >= libsMin &&
                    validLibMoves[x - 1][y] <= libsMax) ||
                (x < size - 1 &&
                    board[x + 1][y] === you &&
                    validLibMoves[x + 1][y] >= libsMin &&
                    validLibMoves[x + 1][y] <= libsMax) ||
                (y > 0 &&
                    board[x][y - 1] === you &&
                    validLibMoves[x][y - 1] >= libsMin &&
                    validLibMoves[x][y - 1] <= libsMax) ||
                (y < size - 1 &&
                    board[x][y + 1] === you &&
                    validLibMoves[x][y + 1] >= libsMin &&
                    validLibMoves <= libsMax)
                    ? true
                    : false;
            const surround = getSurroundLibs(x, y, me);
            const freeSpace = getFreeSpace(x, y);
            if (freeSpace < minFreeSpace) continue;
            if (!isAttack || surround < minSurround) continue;
            const chainAtk = getChainAttack(x, y);
            if (chainAtk < minChain) continue;
            let lowestLibs = 999;
            if (x > 0 && board[x - 1][y] === you && validLibMoves[x - 1][y] < lowestLibs)
                lowestLibs = validLibMoves[x - 1][y];
            if (x < size - 1 && board[x + 1][y] === you && validLibMoves[x + 1][y] < lowestLibs)
                lowestLibs = validLibMoves[x + 1][y];
            if (y > 0 && board[x][y - 1] === you && validLibMoves[x][y - 1] < lowestLibs)
                lowestLibs = validLibMoves[x][y - 1];
            if (y < size - 1 && board[x][y + 1] === you && validLibMoves[x][y + 1] < lowestLibs)
                lowestLibs = validLibMoves[x][y + 1];

            const friendlyLibs = getSurroundLibs(x, y, me);
            const startEyeValue = getEyeValue(x, y, you);
            const eyeValue = startEyeValue > 1 ? startEyeValue : 1;

            const atk =
                ((((friendlyLibs * chainAtk) / eyeValue) * getHeatMap(x, y, me)) / lowestLibs) *
                (getEyeValue(x, y, me) + 1);

            if (atk > highestValue) {
                highestValue = atk;
                moveOptions.length = 0;
                moveOptions.push([x, y]);
            } else if (atk === highestValue) {
                highestValue = atk;
                moveOptions.push([x, y]);
            }
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Defensive Attack: " + libsMin + "/" + libsMax + "  Surround: " + minSurround,
              }
            : [];
    }
    function attackGrowDragon(requiredEyes, killLib = false) {
        const moveOptions = [];
        let highestValue = 0;
        // Look through all the points on the board
        const moves = getAllValidMoves(true);
        for (const [x, y] of moves) {
            if (contested[x][y] !== "?" || createsLib(x, y, me)) continue;
            const surround = getSurroundEnemiesFull(x, y);
            const myLibs = getSurroundLibs(x, y, me);
            if (surround < 1 || myLibs < 3) continue;
            const enemyLibs = getSurroundLibs(x, y, you);
            if (enemyLibs === 1 && !killLib) continue;
            const enemyChains = getChainAttackFull(x, y);
            const myEyes = getEyeValueFull(x, y, me);
            if (myEyes < requiredEyes) continue; // || count === 3) continue
            const result = enemyLibs * enemyChains; // surround * enemyLibs * myChains *  /*freeSpace * */ enemyEyes * enemyChains

            if (result > highestValue) {
                highestValue = result;
                moveOptions.length = 0;
                moveOptions.push([x, y]);
            } else if (result === highestValue) {
                highestValue = result;
                moveOptions.push([x, y]);
            }
        }
        // Choose one of the found moves at random
        const randomIndex = Math.floor(Math.random() * moveOptions.length);
        return moveOptions[randomIndex]
            ? {
                  coords: moveOptions[randomIndex],
                  msg: "Attack/Grow Dragon: " + requiredEyes,
              }
            : [];
    }
    function getDefPattern() {
        let def = [];
        def.push(...def5);

        const moves = getAllValidMoves();
        for (const [x, y] of moves) {
            for (const pattern of def)
                if (isPattern(x, y, pattern)) {
                    const msg = ns.print(
                        "Def Pattern: %s\n%s\n%s",
                        pattern.length,
                        pattern.join("\n"),
                        "---------------",
                    );
                    return {
                        coords: [x, y],
                        msg: msg,
                    };
                }
        }
        return [];
    }
    function disruptEyes() {
        let disrupt = [];
        disrupt.push(...disrupt4);
        disrupt.push(...disrupt5);

        const moves = getAllValidMoves();
        for (const [x, y] of moves) {
            for (const pattern of disrupt)
                if (isPattern(x, y, pattern)) {
                    const msg = ns.print(
                        "Eye Disruption: %s\n%s\n%s",
                        pattern.length,
                        pattern.join("\n"),
                        "---------------",
                    );
                    return {
                        coords: [x, y],
                        msg: msg,
                    };
                }
        }
        return [];
    }
    async function movePiece(attack) {
        if (attack.coords === undefined) return false;
        const [x, y] = attack.coords;
        if (x === undefined) return false;
        let mid = performance.now();
        ns.printf("%s", attack.msg);
        const results = await ns.go.makeMove(x, y, playAsWhite);
        let END = performance.now();
        if (LOGTIME) ns.printf("Time: Me: %s  Them: %s", ns.tFormat(mid - START, true), ns.tFormat(END - mid, true));
        START = performance.now();
        return results;
    }
    async function moveSnakeEyes(attack) {
        if (attack.coords === undefined || !CHEATS) return false;
        const [s1x, s1y, s2x, s2y] = attack.coords;
        if (s1x === undefined) return false;
        try {
            const chance = ns.go.cheat.getCheatSuccessChance(undefined, playAsWhite);
            if (chance < 0.7) return false;
            let mid = performance.now();
            const results = await ns.go.cheat.playTwoMoves(s1x, s1y, s2x, s2y, playAsWhite);
            ns.printf("%s", attack.msg);
            let END = performance.now();
            if (LOGTIME)
                ns.printf("Time: Me: %s  Them: %s", ns.tFormat(mid - START, true), ns.tFormat(END - mid, true));
            START = performance.now();
            return results;
        } catch {
            return false;
        }
    }
    function getAllValidMoves(notMine = false) {
        if (currentValidMovesTurn === turn) return notMine ? currentValidContestedMoves : currentValidMoves;
        let moves = [];
        let contestedMoves = [];
        for (let x = 0; x < board[0].length; x++)
            for (let y = 0; y < board[0].length; y++) {
                if (validMove[x][y]) {
                    if ([you, "?"].includes(contested[x][y])) contestedMoves.push([x, y]);
                    moves.push([x, y]);
                }
            }

        //Moves contains a randomized array of x,y
        moves = moves.sort(() => Math.random() - Math.random());
        contestedMoves = contestedMoves.sort(() => Math.random() - Math.random());
        currentValidMoves = moves;
        currentValidContestedMoves = contestedMoves;
        currentValidMovesTurn = turn;
        return notMine ? currentValidContestedMoves : currentValidMoves;
    }
    function createsLib(x, y, player) {
        const size = board[0].length;

        if (x > 0 && board[x - 1][y] === player && validLibMoves[x - 1][y] > 2) return false;
        if (x < size - 1 && board[x + 1][y] === player && validLibMoves[x + 1][y] > 2) return false;
        if (y > 0 && board[x][y - 1] === player && validLibMoves[x][y - 1] > 2) return false;
        if (y < size - 1 && board[x][y + 1] === player && validLibMoves[x][y + 1] > 2) return false;

        if (x > 0 && board[x - 1][y] === player && validLibMoves[x - 1][y] === 2) return true;
        if (x < size - 1 && board[x + 1][y] === player && validLibMoves[x + 1][y] === 2) return true;
        if (y > 0 && board[x][y - 1] === player && validLibMoves[x][y - 1] === 2) return true;
        if (y < size - 1 && board[x][y + 1] === player && validLibMoves[x][y + 1] === 2) return true;

        return false;
    }
    function getOpeningMove() {
        const size = board[0].length;
        switch (size) {
            case 13:
                if (getSurroundSpace(2, 2) === 4 && validMove[2][2])
                    return {
                        coords: [2, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(2, 10) === 4 && validMove[2][10])
                    return {
                        coords: [2, 10],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(10, 10) === 4 && validMove[10][10])
                    return {
                        coords: [10, 10],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(10, 2) === 4 && validMove[10][2])
                    return {
                        coords: [10, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 3) === 4 && validMove[3][3])
                    return {
                        coords: [3, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 9) === 4 && validMove[3][9])
                    return {
                        coords: [3, 9],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(9, 9) === 4 && validMove[9][9])
                    return {
                        coords: [9, 9],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(9, 3) === 4 && validMove[9][3])
                    return {
                        coords: [9, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(4, 4) === 4 && validMove[4][4])
                    return {
                        coords: [4, 4],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(4, 8) === 4 && validMove[4][8])
                    return {
                        coords: [4, 8],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(8, 8) === 4 && validMove[8][8])
                    return {
                        coords: [8, 8],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(8, 4) === 4 && validMove[8][4])
                    return {
                        coords: [8, 4],
                        msg: "Opening Move: " + turn,
                    };
                else return getRandomStrat();
            case 9:
                if (getSurroundSpace(2, 2) === 4 && validMove[2][2])
                    return {
                        coords: [2, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(2, 6) === 4 && validMove[2][6])
                    return {
                        coords: [2, 6],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(6, 6) === 4 && validMove[6][6])
                    return {
                        coords: [6, 6],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(6, 2) === 4 && validMove[6][2])
                    return {
                        coords: [6, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 3) === 4 && validMove[3][3])
                    return {
                        coords: [3, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 5) === 4 && validMove[3][5])
                    return {
                        coords: [3, 5],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(5, 5) === 4 && validMove[5][5])
                    return {
                        coords: [5, 5],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(5, 3) === 4 && validMove[5][3])
                    return {
                        coords: [5, 3],
                        msg: "Opening Move: " + turn,
                    };
                else return getRandomStrat();
            case 7:
                if (getSurroundSpace(2, 2) === 4 && validMove[2][2])
                    return {
                        coords: [2, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(2, 4) === 4 && validMove[2][4])
                    return {
                        coords: [2, 4],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(4, 4) === 4 && validMove[4][4])
                    return {
                        coords: [4, 4],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(4, 2) === 4 && validMove[4][2])
                    return {
                        coords: [4, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 3) === 4 && validMove[3][3])
                    return {
                        coords: [3, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(1, 1) === 4 && validMove[1][1])
                    return {
                        coords: [1, 1],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(5, 1) === 4 && validMove[5][1])
                    return {
                        coords: [5, 1],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(5, 5) === 4 && validMove[5][5])
                    return {
                        coords: [5, 5],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(1, 5) === 4 && validMove[1][5])
                    return {
                        coords: [1, 5],
                        msg: "Opening Move: " + turn,
                    };
                else return getRandomStrat();
            case 5:
                if (getSurroundSpace(2, 2) === 4 && validMove[2][2])
                    return {
                        coords: [2, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 3) === 4 && validMove[3][3])
                    return {
                        coords: [3, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 1) === 4 && validMove[3][1])
                    return {
                        coords: [3, 1],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(1, 3) === 4 && validMove[1][3])
                    return {
                        coords: [1, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(1, 1) === 4 && validMove[1][1])
                    return {
                        coords: [1, 1],
                        msg: "Opening Move: " + turn,
                    };
                else return getRandomStrat();
            case 19:
                if (getSurroundSpace(9, 9) === 4 && validMove[9][9])
                    return {
                        coords: [9, 9],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(2, 2) === 4 && validMove[2][2])
                    return {
                        coords: [2, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(16, 2) === 4 && validMove[16][2])
                    return {
                        coords: [16, 2],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(2, 16) === 4 && validMove[2][16])
                    return {
                        coords: [2, 16],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(16, 16) === 4 && validMove[16][16])
                    return {
                        coords: [16, 16],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 3) === 4 && validMove[3][3])
                    return {
                        coords: [3, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(3, 15) === 4 && validMove[3][15])
                    return {
                        coords: [3, 15],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(15, 15) === 4 && validMove[15][15])
                    return {
                        coords: [15, 15],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(15, 3) === 4 && validMove[15][3])
                    return {
                        coords: [15, 3],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(4, 4) === 4 && validMove[4][4])
                    return {
                        coords: [4, 4],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(4, 14) === 4 && validMove[4][14])
                    return {
                        coords: [4, 14],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(14, 14) === 4 && validMove[14][14])
                    return {
                        coords: [14, 14],
                        msg: "Opening Move: " + turn,
                    };
                else if (getSurroundSpace(14, 4) === 4 && validMove[14][4])
                    return {
                        coords: [14, 4],
                        msg: "Opening Move: " + turn,
                    };
                else return getRandomStrat();
        }
    }
}

//X,O = Black, White  x, o = Anything but the other person or a blocking, "W" space is off the board, ? is anything goes
//B is blocking(Wall or you, not empty or enemy), b is blocking but could be enemy, A is All but . (Wall, Me, You, Blank)
//* is move here next if you can - no safeties

const disrupt4 = [
    ["??b?", "?b.b", "b.*b", "?bb?"], //Pattern# Sphyxis - buy a turn #GREAT
    ["?bb?", "b..b", "b*Xb", "?bb?"], //Pattern# Sphyxis - buy a turn #GREAT
    ["?bb?", "b..b", "b.*b", "?bb?"], //Pattern# Sphyxis - buy a turn #GREAT
    ["??b?", "?b.b", "?b*b", "??O?"], //Pattern# Sphyxis - Sacrifice to kill an eye
    ["?bbb", "bb.b", "W.*b", "?oO?"], //Pattern# Sphyxis - 2x2 nook breatk
    ["?bbb", "bb.b", "W.*b", "?Oo?"], //Pattern# Sphyxis - 2x2 nook break
    [".bbb", "o*.b", ".bbb", "????"], //Pattern# Sphyxis - Dangling 2 break
];
const disrupt5 = [
    ["?bbb?", "b.*.b", "?bbb?", "?????", "?????"], //Pattern# Sphyxis - Convert to 1 eye
    ["??OO?", "?b*.b", "?b..b", "??bb?", "?????"], //Pattern# Sphyxis - Buy time
    ["?????", "??bb?", "?b*Xb", "?boob", "??bb?"], //Pattern# Sphyxis - Buy time
    ["WWW??", "WWob?", "Wo*b?", "WWW??", "?????"], //Pattern# Sphyxis - 2x2 attack corner if possible
    ["??b??", "?b.b?", "?b*b?", "?b.A?", "??b??"], //Pattern# Sphyxis - Break two eyes into 1, buy a turn
    ["??b??", "?b.b?", "??*.b", "?b?b?", "?????"], //Pattern# Sphyxis - Break eyes, buy time
    ["?WWW?", "WoOoW", "WOO*W", "W???W", "?????"], //Block 3x3 corner
    ["?WWW?", "Wo*oW", "WOOOW", "W???W", "?????"], //Block 3x3 corner
];

const def5 = [
    ["?WW??", "WW.X?", "W.XX?", "WWW??", "?????"], //Pattern# Sphyxis - Eyes in a nook
    ["WWW??", "WW.X?", "W.*X?", "WWW??", "?????"], //Pattern# Sphyxis - 2x2 corner contain #GREAT
    ["BBB??", "BB.X?", "B..X?", "BBB??", "?????"], //Pattern# Sphyxis - 2x2 corner contain #GREAT
    ["?WWW?", "W.*.W", "WXXXW", "?????", "?????"], //Take the 3x3 back corner
];

// Testing
//const opponent = ["No AI"]
//const opponent2 = ["No AI"]
// Original
// const opponent = ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];
// const opponent2 = ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati", "????????????"];
