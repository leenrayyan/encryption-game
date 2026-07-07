// Flavor content pools for round generation (client-side copy — the browser
// runs the game logic now). Kept separate from generators so writing can be
// tweaked without touching logic.

export const ROUND1_PHRASES = [
  "WE COME IN PEACE",
  "OPEN THE OUTER GATE",
  "SEND HELP NOW",
  "THE CREW IS SAFE",
  "HOLD YOUR POSITION",
  "SIGNAL IS STABLE",
];

export const ROUND2_PHRASES = [
  "TRUST THE BEACON",
  "POWER CORE OFFLINE",
  "AWAIT OUR ARRIVAL",
  "COORDINATES LOCKED IN",
  "DO NOT RESPOND YET",
  "THE ORBIT IS CLEAR",
];

// ---- Round 3: trap-signal ----
// Two genuine orders begin with the codeword; the impostor does not.
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

export const ROUND4_KEYWORDS = ["NOVA", "ORBIT", "LUNAR", "ECHO", "COMET", "VOID"];
export const ROUND4_PHRASES = [
  "THE OTHERS ARE LISTENING",
  "RETURN TO THE SURFACE",
  "OUR SHIP IS NOT ALONE",
  "COORDINATES WERE A TRAP",
  "REROUTE ALL POWER AFT",
  "THE HOST WORLD IS DYING",
];

// ---- Round 5: pigpen finale ----
export interface FinalScenario {
  message: string;
  prompt: string;
  options: { id: string; label: string }[];
  endings: Record<string, { headline: string; detail: string }>;
}
export const ROUND5_SCENARIOS: FinalScenario[] = [
  {
    message: "THE CORE IS FAILING",
    prompt: "The reactor is critical. What does your station transmit?",
    options: [
      { id: "sever", label: "SEVER THE LINK" },
      { id: "hold", label: "HOLD THE LINE" },
    ],
    endings: {
      sever: {
        headline: "THE LINK IS SEVERED",
        detail:
          "The stations cut the connection. The alien signal goes silent — the ship is saved, but first contact is lost to the dark. Perhaps that was the safer ending.",
      },
      hold: {
        headline: "THE LINE HOLDS",
        detail:
          "Against protocol, the crews held the connection open. The core stabilized at the last second — and the signal spoke one final word: thank you.",
      },
    },
  },
  {
    message: "THEY ASK TO COME ABOARD",
    prompt: "The visitors request docking. Your call?",
    options: [
      { id: "welcome", label: "OPEN THE AIRLOCK" },
      { id: "refuse", label: "KEEP IT SEALED" },
    ],
    endings: {
      welcome: {
        headline: "THE AIRLOCK OPENS",
        detail:
          "The stations chose trust. What steps aboard is not what anyone expected — and the story of two species begins here, in your hands.",
      },
      refuse: {
        headline: "THE HULL STAYS SEALED",
        detail:
          "The crews held the line. The visitors drift away without a word. Safe — but you'll wonder forever what you turned away.",
      },
    },
  },
  {
    message: "THE SIGNAL WANTS AN ANSWER",
    prompt: "First contact awaits your reply.",
    options: [
      { id: "reply", label: "SEND A GREETING" },
      { id: "silent", label: "STAY DARK" },
    ],
    endings: {
      reply: {
        headline: "A GREETING GOES OUT",
        detail:
          "Every station transmitted at once. The reply that returns is in your own words, sent back across the stars. We are not alone — and now they know we answered.",
      },
      silent: {
        headline: "THE STATIONS STAY DARK",
        detail:
          "You chose silence. The signal fades and does not return. Some doors, once closed, do not open again.",
      },
    },
  },
];

export const ROUND_META = [
  {
    title: "First Contact",
    storyBeat:
      "A faint alien signal breaks through static. Your ground station is the first to lock on. Decode the opening transmission.",
    timeLimitSec: 300,
  },
  {
    title: "The Beacon Replies",
    storyBeat:
      "Something on the other end is responding. The signal has shifted frequency — your dial can find the offset.",
    timeLimitSec: 300,
  },
  {
    title: "False Signals",
    storyBeat:
      "Three orders arrive at once — but one is a forgery meant to sabotage you. Decode all three and flag the impostor.",
    timeLimitSec: 360,
  },
  {
    title: "A Hidden Key",
    storyBeat:
      "This layer won't yield without a keyword. Solve the console's puzzle to derive it — the message beneath is a warning.",
    timeLimitSec: 420,
  },
  {
    title: "The Last Transmission",
    storyBeat:
      "One final message in an ancient hand. Decode it — then your station must decide how to answer.",
    timeLimitSec: 360,
  },
] as const;
