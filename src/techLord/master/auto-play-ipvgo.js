// Auto play ipvgo
/** @param {NS} ns */
export async function main(ns) {
  const targetServer = ns.args[0] || "home";

  while (true) {
    let ipvgoRunning = ns.isRunning('techLord/master/ipvgo.js', targetServer);
    // let ipvgoRunning = ns.go.getCurrentPlayer() !== "None"; // Cannot figure out how to continue playing Go from mid game yet

    // If not running, execute the script
    if (!ipvgoRunning) {
      // Determine which opponent to reset the board against
      const opponents = [
        "Netburners", // increased hacknet production
        "Slum Snakes", // crime success rate
        "The Black Hand", // hacking money
        "Tetrads", // strength, defense, dexterity, and agility levels
        "Daedalus", // reputation gain
        "Illuminati", // faster hack(), grow(), and weaken()
      ];
      const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];

      // Reset the board state with the randomly chosen opponent
      ns.go.resetBoardState(randomOpponent, 13);

      // Start the new game
      ns.scp('techLord/master/ipvgo.js', targetServer);
      ns.exec('techLord/master/ipvgo.js', targetServer);
      ns.print(`Started techLord/master/ipvgo.js against ${randomOpponent}`);
    }
    await ns.sleep(100);
	}
}