// Flavor + content pools for round generation (browser runs the game logic).

// ---- Round 1: Pigpen (approachable visual warm-up) ----
export const ROUND1_PHRASES = [
  "WE COME IN PEACE",
  "OPEN THE OUTER GATE",
  "SEND HELP NOW",
  "THE CREW IS SAFE",
  "HOLD YOUR POSITION",
  "SIGNAL IS STABLE",
];

// ---- Round 2: shift cipher ----
export const ROUND2_PHRASES = [
  "TRUST THE BEACON",
  "POWER CORE OFFLINE",
  "AWAIT OUR ARRIVAL",
  "COORDINATES LOCKED IN",
  "DO NOT RESPOND YET",
  "THE ORBIT IS CLEAR",
];

// ---- Round 3: trap-signal (decode all three, TYPE the impostor's order) ----
export const ROUND3_CODEWORDS = ["ORION", "VEGA", "ATLAS", "LYRA"];
export const ROUND3_GENUINE = [
  "SEAL THE DECK",
  "HOLD THE LINE",
  "VENT THE BAY",
  "ARM THE CORE",
  "RAISE SHIELDS",
];
export const ROUND3_IMPOSTOR = [
  "IGNORE ALL ORDERS",
  "OPEN EVERY DOOR",
  "DROP YOUR SHIELDS",
  "ABANDON THE SHIP",
  "STAND DOWN NOW",
];

// ---- Round 4: keyed layer (Vigenere) ----
export const ROUND4_KEYWORDS = ["NOVA", "ORBIT", "LUNAR", "ECHO", "COMET", "VOID"];
export const ROUND4_PHRASES = [
  "THE OTHERS ARE LISTENING",
  "RETURN TO THE SURFACE",
  "OUR SHIP IS NOT ALONE",
  "COORDINATES WERE A TRAP",
  "REROUTE ALL POWER AFT",
  "THE HOST WORLD IS DYING",
];

// ---- Round 5: Playfair finale (serious cipher + branching ending) ----
// Messages are Playfair-clean: no J, no adjacent duplicate letters, even length
// (so no filler letters are inserted and the decode reads cleanly).
export const PLAYFAIR_KEYWORDS = ["NEBULA", "ORION", "QUASAR", "PULSAR", "COMET"];

export interface FinalScenario {
  message: string;
  prompt: string;
  options: { id: string; label: string }[];
  endings: Record<string, { headline: string; detail: string }>;
}
export const ROUND5_SCENARIOS: FinalScenario[] = [
  {
    message: "THE CORE IS FAILING",
    prompt: "Their reactor is dying. What does your station transmit?",
    options: [
      { id: "sever", label: "SEVER THE LINK" },
      { id: "hold", label: "HOLD THE LINE" },
    ],
    endings: {
      sever: {
        headline: "THE LINK IS SEVERED",
        detail:
          "The stations cut the connection. The signal goes silent — the ship is saved, but first contact is lost to the dark. Perhaps that was the safer ending.",
      },
      hold: {
        headline: "THE LINE HOLDS",
        detail:
          "Against every protocol, the crews held the connection open. The core stabilized at the last second — and the signal spoke one final word: thank you.",
      },
    },
  },
  {
    message: "OUR SIGNAL IS HEARD",
    prompt: "They know we are listening. What is your reply?",
    options: [
      { id: "reply", label: "SEND A REPLY" },
      { id: "silent", label: "STAY SILENT" },
    ],
    endings: {
      reply: {
        headline: "WE REPLIED",
        detail:
          "Every station transmitted at once. The answer that returns is in our own words, sent back across the stars. We are not alone — and now they know we answered.",
      },
      silent: {
        headline: "WE STAYED SILENT",
        detail:
          "You chose silence. The signal fades and does not return. Some doors, once closed, do not open again.",
      },
    },
  },
  {
    message: "WE MADE FIRST CONTACT",
    prompt: "It is real, and it is here. Who do we tell?",
    options: [
      { id: "tell", label: "TELL EARTH" },
      { id: "secret", label: "KEEP IT SECRET" },
    ],
    endings: {
      tell: {
        headline: "EARTH IS TOLD",
        detail:
          "The message goes out to every receiver on the homeworld. Tonight, everyone looks up at the same sky — and it looks back. Nothing will be the same.",
      },
      secret: {
        headline: "THE SECRET IS KEPT",
        detail:
          "The stations agree to hold the truth close. Somewhere out there, something waits for a world that isn't ready to know it exists. Not yet.",
      },
    },
  },
];

export const ROUND_META = [
  {
    title: "First Contact",
    storyBeat:
      "Decades of static — then this. The first symbols of something that is not human. Read them.",
    timeLimitSec: 300,
  },
  {
    title: "The Beacon Replies",
    storyBeat:
      "It heard you. The reply comes shifted in frequency — roll the dial to bring it home.",
    timeLimitSec: 300,
  },
  {
    title: "False Signals",
    storyBeat:
      "Three orders arrive at once. One is a forgery meant to turn us against them. Decode all three and transmit the fake one back.",
    timeLimitSec: 360,
  },
  {
    title: "A Hidden Key",
    storyBeat:
      "This layer is sealed. Solve the console to lift the keyword — the warning beneath was meant only for us.",
    timeLimitSec: 420,
  },
  {
    title: "The Last Transmission",
    storyBeat:
      "One final message, in their oldest hand — a cipher within a cipher. Decode it. Then your station decides how humanity answers.",
    timeLimitSec: 420,
  },
] as const;
