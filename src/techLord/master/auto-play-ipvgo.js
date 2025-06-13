// Auto play ipvgo
/** @param {NS} ns */
export async function main(ns) {
  while (true) {
    let ipvgoRunning = ns.isRunning('techLord/master/ipvgo.js', 'home');

    // If not running, execute the script
    if (!ipvgoRunning) {
      // Determine which opponent to reset the board against
      const opponents = [
        // "Netburners",
        // "Slum Snakes",
        "The Black Hand",
        // "Tetrads",
        "Daedalus",
        "Illuminati",
      ];
      const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];

      // Reset the board state with the randomly chosen opponent
      ns.go.resetBoardState(randomOpponent, 13);

      // Start the new game
      ns.exec('techLord/master/ipvgo.js', "home");
      ns.print(`Started techLord/master/ipvgo.js against ${randomOpponent}`);
    }
    await ns.sleep(3000);
	}
}