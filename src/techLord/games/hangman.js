/** @param {NS} ns */
export async function main(ns) {
    const words = [
        "able",
        "abstract",
        "about",
        "accelerate",
        "acceleration",
        "accept",
        "access",
        "account",
        "acid",
        "across",
        "act",
        "addition",
        "address",
        "adjust",
        "adjustment",
        "adventure",
        "advertisement",
        "after",
        "again",
        "against",
        "agility",
        "agree",
        "agreement",
        "air",
        "all",
        "ally",
        "almost",
        "alone",
        "among",
        "amount",
        "amusement",
        "ancient",
        "and",
        "android",
        "anger",
        "angle",
        "animal",
        "answer",
        "ant",
        "any",
        "apparatus",
        "apple",
        "application",
        "apply",
        "approval",
        "arch",
        "argument",
        "arm",
        "army",
        "art",
        "artificial",
        "assemble",
        "assembly",
        "atmosphere",
        "atom",
        "attack",
        "attempt",
        "attention",
        "attract",
        "attraction",
        "augment",
        "augmentation",
        "authority",
        "authorize",
        "automatic",
        "awake",
        "baby",
        "back",
        "backward",
        "bad",
        "bag",
        "balance",
        "ball",
        "band",
        "base",
        "basin",
        "basket",
        "bath",
        "battle",
        "beam",
        "beauty",
        "beautiful",
        "because",
        "bed",
        "bee",
        "before",
        "behaviour",
        "belief",
        "bell",
        "bend",
        "berry",
        "between",
        "binary",
        "biology",
        "biological",
        "bird",
        "birth",
        "bit",
        "bite",
        "bitter",
        "black",
        "blade",
        "bleed",
        "blood",
        "blow",
        "blue",
        "board",
        "boat",
        "body",
        "boil",
        "bomb",
        "bone",
        "book",
        "boot",
        "boss",
        "bottle",
        "box",
        "boy",
        "brain",
        "branch",
        "brass",
        "bread",
        "break",
        "breath",
        "breed",
        "brick",
        "bridge",
        "bright",
        "brother",
        "brown",
        "brush",
        "bubble",
        "bucket",
        "build",
        "building",
        "bulb",
        "burn",
        "burst",
        "business",
        "butter",
        "button",
        "buy",
        "cake",
        "calculate",
        "calculator",
        "camera",
        "canvas",
        "car",
        "card",
        "care",
        "carriage",
        "cart",
        "cartridge",
        "case",
        "cat",
        "cause",
        "cave",
        "cavern",
        "ceiling",
        "center",
        "certain",
        "chain",
        "chalk",
        "character",
        "charisma",
        "chance",
        "change",
        "cheap",
        "cheese",
        "chemical",
        "chemistry",
        "chest",
        "chief",
        "child",
        "chin",
        "church",
        "circle",
        "clean",
        "clear",
        "client",
        "clock",
        "clone",
        "close",
        "cloth",
        "cloud",
        "citadel",
        "city",
        "coal",
        "coat",
        "code",
        "cold",
        "collar",
        "color",
        "comb",
        "come",
        "comfort",
        "command",
        "committee",
        "common",
        "company",
        "comparison",
        "competition",
        "complete",
        "complex",
        "compound",
        "compute",
        "computer",
        "condition",
        "confirm",
        "confirmation",
        "connect",
        "connection",
        "conquer",
        "conscious",
        "continue",
        "control",
        "cook",
        "copper",
        "copy",
        "cord",
        "cork",
        "corporate",
        "corporation",
        "cost",
        "cotton",
        "cough",
        "country",
        "cover",
        "cow",
        "crack",
        "crash",
        "craze",
        "crazy",
        "credit",
        "creep",
        "crevice",
        "crime",
        "cruel",
        "crush",
        "crust",
        "cry",
        "cup",
        "current",
        "curtain",
        "curve",
        "cushion",
        "cute",
        "cyber",
        "damage",
        "danger",
        "dark",
        "daughter",
        "data",
        "date",
        "dawn",
        "day",
        "dead",
        "dear",
        "death",
        "debt",
        "decision",
        "decline",
        "decrease",
        "decryption",
        "deep",
        "default",
        "defeat",
        "defense",
        "deficit",
        "deicide",
        "degree",
        "delicate",
        "demon",
        "denial",
        "deny",
        "depend",
        "dependent",
        "depth",
        "design",
        "desire",
        "destiny",
        "destroy",
        "destruction",
        "detail",
        "detect",
        "develop",
        "development",
        "dexterity",
        "diction",
        "dictionary",
        "differ",
        "different",
        "digest",
        "digestion",
        "direct",
        "direction",
        "dirt",
        "disagree",
        "disagreement",
        "discover",
        "discovery",
        "discuss",
        "discussion",
        "disease",
        "disgust",
        "distance",
        "distribute",
        "distribution",
        "divide",
        "division",
        "do",
        "dog",
        "door",
        "double",
        "doubt",
        "down",
        "drain",
        "draw",
        "drawer",
        "dream",
        "dress",
        "drink",
        "drive",
        "drone",
        "drop",
        "dry",
        "dusk",
        "dust",
        "ear",
        "early",
        "earth",
        "ease",
        "east",
        "easy",
        "economy",
        "edge",
        "educate",
        "education",
        "effect",
        "egg",
        "elastic",
        "electric",
        "element",
        "encryption",
        "end",
        "enemy",
        "enhance",
        "enhancement",
        "engine",
        "engineer",
        "enough",
        "enrage",
        "enter",
        "entry",
        "environment",
        "equal",
        "error",
        "even",
        "evening",
        "event",
        "every",
        "everything",
        "evil",
        "example",
        "exchange",
        "execute",
        "execution",
        "existence",
        "expand",
        "expansion",
        "expend",
        "expense",
        "experience",
        "expert",
        "explode",
        "exploration",
        "explore",
        "explosion",
        "expiration",
        "expire",
        "export",
        "eye",
        "face",
        "fact",
        "factor",
        "factory",
        "fall",
        "false",
        "fame",
        "family",
        "far",
        "farm",
        "fast",
        "fat",
        "father",
        "fear",
        "feather",
        "feeble",
        "feed",
        "feel",
        "feeling",
        "female",
        "fertile",
        "fiction",
        "field",
        "fight",
        "file",
        "fill",
        "filter",
        "finger",
        "finite",
        "fire",
        "first",
        "fish",
        "fix",
        "flag",
        "flame",
        "flamingo",
        "flat",
        "flesh",
        "flight",
        "float",
        "floor",
        "flow",
        "flower",
        "fluence",
        "fluent",
        "fly",
        "foe",
        "fold",
        "folder",
        "food",
        "fool",
        "foot",
        "force",
        "fork",
        "form",
        "forward",
        "fowl",
        "frame",
        "free",
        "frequent",
        "friend",
        "from",
        "front",
        "fruit",
        "full",
        "fun",
        "function",
        "future",
        "game",
        "gang",
        "garden",
        "gas",
        "gate",
        "gender",
        "gene",
        "general",
        "gentle",
        "get",
        "ghost",
        "girl",
        "give",
        "glass",
        "glove",
        "go",
        "goat",
        "god",
        "gold",
        "good",
        "government",
        "grain",
        "grass",
        "great",
        "green",
        "grey",
        "grip",
        "group",
        "grow",
        "growth",
        "guide",
        "gun",
        "hack",
        "hair",
        "hammer",
        "hand",
        "hang",
        "happy",
        "harbor",
        "hard",
        "harmony",
        "hat",
        "hate",
        "have",
        "head",
        "health",
        "heap",
        "hear",
        "heart",
        "heat",
        "height",
        "help",
        "hide",
        "high",
        "history",
        "hold",
        "hole",
        "hollow",
        "hook",
        "hope",
        "horn",
        "horse",
        "hospital",
        "host",
        "hour",
        "house",
        "how",
        "humor",
        "ice",
        "idea",
        "ill",
        "illuminate",
        "illusion",
        "immoral",
        "immortal",
        "import",
        "important",
        "impulse",
        "increase",
        "independent",
        "industry",
        "infamy",
        "infiltrate",
        "infiltration",
        "infinite",
        "infinity",
        "influence",
        "ink",
        "insect",
        "inside",
        "instrument",
        "insurance",
        "integer",
        "intelligence",
        "intelligent",
        "interest",
        "interface",
        "internet",
        "invent",
        "invention",
        "invitation",
        "invite",
        "iron",
        "island",
        "iterate",
        "iteration",
        "jelly",
        "jewel",
        "job",
        "join",
        "journey",
        "judge",
        "jump",
        "keep",
        "kettle",
        "key",
        "keyword",
        "kick",
        "kill",
        "kind",
        "kiss",
        "knee",
        "knife",
        "knot",
        "knowledge",
        "land",
        "language",
        "last",
        "late",
        "latex",
        "laugh",
        "law",
        "lead",
        "leaf",
        "learn",
        "leather",
        "left",
        "leg",
        "letter",
        "level",
        "library",
        "lie",
        "life",
        "lift",
        "light",
        "like",
        "limit",
        "line",
        "linen",
        "lip",
        "liquid",
        "list",
        "little",
        "live",
        "lock",
        "logic",
        "long",
        "look",
        "loose",
        "loop",
        "lose",
        "loss",
        "lost",
        "lord",
        "loud",
        "love",
        "low",
        "machine",
        "mad",
        "madness",
        "magnitude",
        "make",
        "male",
        "main",
        "maintain",
        "maintenance",
        "man",
        "manage",
        "manager",
        "map",
        "mark",
        "market",
        "marine",
        "marry",
        "mass",
        "master",
        "match",
        "material",
        "matter",
        "maximum",
        "meal",
        "measure",
        "meat",
        "mechanical",
        "medal",
        "medic",
        "medical",
        "meet",
        "meeting",
        "memory",
        "metal",
        "method",
        "middle",
        "military",
        "milk",
        "mill",
        "mind",
        "mine",
        "minimum",
        "minute",
        "mist",
        "mix",
        "mixture",
        "mobile",
        "molecule",
        "money",
        "monitor",
        "monkey",
        "monster",
        "month",
        "moon",
        "moral",
        "morale",
        "morning",
        "mortal",
        "mother",
        "motion",
        "mountain",
        "mouth",
        "move",
        "multiple",
        "multiplication",
        "murder",
        "muscle",
        "music",
        "nail",
        "name",
        "narrow",
        "nation",
        "natural",
        "nature",
        "near",
        "necessary",
        "neck",
        "need",
        "needle",
        "nerve",
        "nest",
        "neural",
        "net",
        "network",
        "new",
        "night",
        "node",
        "noise",
        "normal",
        "north",
        "nose",
        "note",
        "nuclear",
        "number",
        "nut",
        "object",
        "objective",
        "obligation",
        "obligatory",
        "obsess",
        "obsession",
        "observation",
        "observe",
        "ocean",
        "odd",
        "off",
        "offer",
        "office",
        "oil",
        "old",
        "on",
        "only",
        "open",
        "operate",
        "operation",
        "opinion",
        "opposite",
        "optical",
        "or",
        "orange",
        "order",
        "organization",
        "organize",
        "original",
        "originate",
        "ornament",
        "other",
        "out",
        "outside",
        "oven",
        "over",
        "owner",
        "oxygene",
        "page",
        "pain",
        "paint",
        "paper",
        "parallel",
        "parcel",
        "part",
        "partial",
        "party",
        "pass",
        "passion",
        "past",
        "paste",
        "payment",
        "peace",
        "pen",
        "pencil",
        "perception",
        "person",
        "personal",
        "petroleum",
        "pharmacy",
        "phase",
        "physical",
        "picture",
        "pig",
        "pin",
        "pipe",
        "piracy",
        "pirate",
        "place",
        "plane",
        "planet",
        "plant",
        "plasma",
        "plastic",
        "plate",
        "play",
        "plead",
        "please",
        "pleasure",
        "plough",
        "plural",
        "pocket",
        "poem",
        "point",
        "pointer",
        "poison",
        "pole",
        "police",
        "polish",
        "political",
        "pool",
        "poor",
        "port",
        "portal",
        "porter",
        "position",
        "possible",
        "pot",
        "potato",
        "powder",
        "power",
        "pregnancy",
        "pregnant",
        "present",
        "price",
        "print",
        "prism",
        "prison",
        "private",
        "prize",
        "probable",
        "probability",
        "process",
        "produce",
        "production",
        "profit",
        "program",
        "property",
        "prose",
        "protest",
        "psychology",
        "public",
        "pull",
        "pump",
        "punch",
        "punishment",
        "purchase",
        "purpose",
        "push",
        "put",
        "quality",
        "quantity",
        "question",
        "quick",
        "quiet",
        "quite",
        "radial",
        "radiate",
        "radiation",
        "radical",
        "radio",
        "radium",
        "rage",
        "rail",
        "rain",
        "random",
        "range",
        "rat",
        "rate",
        "ray",
        "react",
        "reaction",
        "read",
        "ready",
        "reason",
        "receipt",
        "record",
        "red",
        "regret",
        "regular",
        "relate",
        "relation",
        "religion",
        "represent",
        "representative",
        "request",
        "respect",
        "respond",
        "responsible",
        "responsive",
        "rest",
        "return",
        "reward",
        "rhythm",
        "rice",
        "rich",
        "right",
        "ring",
        "river",
        "road",
        "robot",
        "robust",
        "rock",
        "rod",
        "roll",
        "roof",
        "room",
        "root",
        "rough",
        "round",
        "rub",
        "rule",
        "run",
        "sad",
        "safe",
        "sail",
        "salt",
        "same",
        "sand",
        "say",
        "scale",
        "scan",
        "school",
        "science",
        "scissors",
        "screw",
        "script",
        "sea",
        "search",
        "seat",
        "second",
        "secret",
        "secretary",
        "security",
        "see",
        "seed",
        "select",
        "selection",
        "self",
        "sell",
        "send",
        "sense",
        "separate",
        "serious",
        "servant",
        "serve",
        "server",
        "sex",
        "shade",
        "shake",
        "shame",
        "sharp",
        "sheep",
        "shelf",
        "shell",
        "ship",
        "shirt",
        "shock",
        "shoe",
        "short",
        "shoot",
        "side",
        "sight",
        "sign",
        "silk",
        "silver",
        "simple",
        "single",
        "singular",
        "singularity",
        "sister",
        "size",
        "skin",
        "skirmish",
        "skirt",
        "sky",
        "slave",
        "sleep",
        "sleeve",
        "slip",
        "slope",
        "slow",
        "slum",
        "small",
        "smart",
        "smash",
        "smell",
        "smile",
        "smoke",
        "smooth",
        "snake",
        "sneeze",
        "snow",
        "soap",
        "society",
        "sock",
        "socket",
        "soft",
        "solid",
        "some",
        "son",
        "song",
        "sort",
        "sound",
        "soup",
        "source",
        "south",
        "space",
        "spade",
        "speak",
        "speaker",
        "special",
        "specialist",
        "speech",
        "speed",
        "spirit",
        "sponge",
        "spoon",
        "spring",
        "spy",
        "square",
        "stack",
        "stage",
        "stamp",
        "star",
        "start",
        "state",
        "statement",
        "station",
        "steal",
        "steam",
        "steel",
        "stem",
        "step",
        "stick",
        "stiff",
        "still",
        "stitch",
        "stock",
        "stomach",
        "stone",
        "stop",
        "store",
        "story",
        "straight",
        "strange",
        "stranger",
        "street",
        "strength",
        "stretch",
        "string",
        "strong",
        "structure",
        "subject",
        "subjective",
        "submarine",
        "substance",
        "subtraction",
        "suburban",
        "such",
        "sudden",
        "sugar",
        "suggest",
        "suggestion",
        "suicide",
        "summer",
        "sun",
        "support",
        "sure",
        "surprise",
        "sweet",
        "switch",
        "swim",
        "sword",
        "synchronize",
        "synchronous",
        "syntax",
        "system",
        "table",
        "tail",
        "take",
        "talk",
        "tall",
        "taste",
        "tax",
        "teach",
        "technology",
        "tendency",
        "terminal",
        "terminate",
        "test",
        "texture",
        "that",
        "then",
        "theory",
        "thick",
        "thin",
        "thing",
        "this",
        "thought",
        "thread",
        "throat",
        "through",
        "thug",
        "thumb",
        "thunder",
        "ticket",
        "tight",
        "time",
        "tin",
        "tired",
        "toe",
        "together",
        "tomorrow",
        "tongue",
        "tooth",
        "top",
        "touch",
        "town",
        "track",
        "trade",
        "train",
        "transaction",
        "transport",
        "trap",
        "tray",
        "tree",
        "trick",
        "trigger",
        "trouble",
        "trousers",
        "true",
        "truth",
        "turn",
        "twist",
        "type",
        "umbrella",
        "under",
        "unit",
        "universe",
        "up",
        "uranium",
        "urban",
        "use",
        "user",
        "utility",
        "value",
        "variable",
        "variation",
        "velocity",
        "vehicle",
        "verse",
        "vessel",
        "victory",
        "view",
        "violent",
        "vision",
        "visual",
        "virtual",
        "virus",
        "voice",
        "wait",
        "walk",
        "wall",
        "war",
        "warm",
        "wash",
        "waste",
        "watch",
        "water",
        "wave",
        "wax",
        "way",
        "weak",
        "wealth",
        "weapon",
        "weather",
        "web",
        "week",
        "weight",
        "welcome",
        "well",
        "west",
        "wet",
        "wheel",
        "when",
        "where",
        "while",
        "whip",
        "whistle",
        "white",
        "who",
        "whole",
        "why",
        "wide",
        "width",
        "wild",
        "wilderness",
        "will",
        "win",
        "wind",
        "window",
        "wine",
        "wing",
        "winter",
        "wire",
        "wise",
        "wit",
        "with",
        "wither",
        "within",
        "woman",
        "wood",
        "wool",
        "word",
        "work",
        "world",
        "worm",
        "wound",
        "write",
        "wrong",
        "year",
        "yellow",
        "yesterday",
        "yield",
        "young",
    ];

    const maxTries = 5;
    let remainingTries = maxTries;

    // Randomly select a word from the list
    const word = words[Math.floor(Math.random() * words.length)];
    let hiddenWord = "_ ".repeat(word.length).trim();
    let guessedLetters = [];
    let wrongLetters = [];

    // Setup terminal input handling
    let terminalInput;
    let terminalHandler;

    ns.tprint(`Welcome to the game of Hangman!`);
    ns.tprint(`The word to guess: ${hiddenWord}`);
    ns.tprint(`You have ${remainingTries} tries remaining.`);

    while (true) {
        terminalInput = eval('document.getElementById("terminal-input")');
        if (!terminalInput) {
            await ns.sleep(1000);
            continue;
        }

        terminalHandler = Object.keys(terminalInput)[1];
        if (terminalInput.value.includes(";")) {
            let terminalCommand = terminalInput.value.trim().toLowerCase();
            let guessedChar = terminalCommand[0]; // We only consider the first character

            if (!/^[a-z]$/.test(guessedChar)) {
                ns.tprint("Please enter a single alphabetical character.");
            } else if (guessedLetters.includes(guessedChar)) {
                ns.tprint("You've already guessed that letter correctly. Try a different one.");
            } else if (wrongLetters.includes(guessedChar)) {
                ns.tprint("You've already guessed that letter incorrectly. Try a different one.");
            } else if (word.includes(guessedChar)) {
                guessedLetters.push(guessedChar);
                hiddenWord = word
                    .split("")
                    .map((letter) => (guessedLetters.includes(letter) ? letter : "_"))
                    .join(" ");
                ns.tprint(`Correct!`);
            } else {
                wrongLetters.push(guessedChar);
                remainingTries--;
                ns.tprint(`Incorrect!`);
            }

            // Always display wrong letters, even after correct guesses or repeated guesses
            ns.tprint(`Wrong letters: ${wrongLetters.join(", ") || "None"}`);

            ns.tprint(`The word: ${hiddenWord}`);
            ns.tprint(`You have ${remainingTries} tries remaining.`);
            ns.tprint("================");

            if (remainingTries === 0) {
                ns.tprint("Game over! You've run out of tries.");
                ns.tprint(`The word was: ${word}`);
                break;
            }

            if (!hiddenWord.includes("_")) {
                ns.tprint(`Congratulations! You've guessed the word: ${word}`);

                const allServers = ns
                    .read("all-list.txt")
                    .split("\n")
                    .map((s) => s.trim())
                    .filter((s) => s !== "");
                const stockServers = ns
                    .read("stock-list.txt")
                    .split("\n")
                    .map((s) => s.trim())
                    .filter((s) => s !== "");
                const validServers = allServers.filter(
                    (s) => ns.hasRootAccess(s) && !stockServers.includes(s) && ns.getServerMaxMoney(s) > 0,
                );

                if (validServers.length > 0) {
                    const randomServer = validServers[Math.floor(Math.random() * validServers.length)];
                    const threads = word.length;
                    ns.tprint(`Executing 'client/masterHack.js' on ${randomServer} with ${threads} threads.`);
                    ns.exec("client/masterHack.js", "home", threads, randomServer);
                } else {
                    ns.tprint("No valid servers found to hack.");
                }

                break;
            }

            terminalInput.value = "";
            terminalInput[terminalHandler].onChange({ target: terminalInput });
        }

        await ns.sleep(1);
    }

    ns.tprint("Hangman game has ended.");
}
