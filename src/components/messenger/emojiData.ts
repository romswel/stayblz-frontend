/**
 * A built-in set of common emoji (no external service). Each entry: "emoji search words".
 * Kept small on purpose; add lines here to offer more.
 */
const RAW: Record<string, string[]> = {
  Smileys: [
    "😀 grin smile happy", "😃 smile happy joy", "😄 laugh smile", "😁 grin beam", "😆 laugh squint", "😅 sweat relief",
    "🤣 rofl laugh floor", "😂 joy tears laugh", "🙂 slight smile", "🙃 upside down", "😉 wink", "😊 blush smile",
    "😇 angel innocent", "🥰 love hearts", "😍 heart eyes love", "🤩 star struck", "😘 kiss", "😗 kiss",
    "😋 yum tasty", "😛 tongue", "😜 wink tongue", "🤪 zany crazy", "😝 tongue squint", "🤑 money rich",
    "🤗 hug", "🤭 oops giggle", "🤫 shush quiet", "🤔 think hmm", "🤐 zip quiet", "🤨 raised eyebrow doubt",
    "😐 neutral", "😑 expressionless", "😶 speechless", "😏 smirk", "😒 unamused", "🙄 eye roll",
    "😬 grimace awkward", "😌 relieved", "😔 pensive sad", "😪 sleepy", "😴 sleep tired", "😷 mask sick",
    "🤒 ill fever", "🤕 hurt injured", "🤢 nauseous", "🤧 sneeze", "🥵 hot", "🥶 cold freezing",
    "😵 dizzy", "🤯 mind blown", "🤠 cowboy", "🥳 party celebrate", "😎 cool sunglasses", "🤓 nerd",
    "😕 confused", "😟 worried", "🙁 frown", "😮 wow surprised", "😯 hushed", "😲 astonished shocked",
    "😳 flushed embarrassed", "🥺 pleading puppy", "😦 frown open", "😧 anguished", "😨 fearful scared", "😰 anxious sweat",
    "😥 sad relieved", "😢 cry sad tear", "😭 sob crying", "😱 scream fear", "😖 confounded", "😣 persevere",
    "😞 disappointed", "😓 downcast sweat", "😩 weary", "😫 tired", "🥱 yawn bored", "😤 triumph huff",
    "😡 angry rage", "😠 angry mad", "🤬 cursing swear", "😈 devil smile", "💀 skull dead", "💩 poop",
    "🤡 clown", "👻 ghost", "👽 alien", "🤖 robot",
  ],
  People: [
    "👋 wave hello bye", "🤚 raised back hand", "✋ hand stop high five", "🖖 vulcan", "👌 ok perfect", "🤌 pinched fingers",
    "✌️ peace victory", "🤞 fingers crossed luck", "🤟 love you", "🤘 rock on", "🤙 call me", "👈 point left",
    "👉 point right", "👆 point up", "👇 point down", "☝️ index up", "👍 thumbs up yes like", "👎 thumbs down no dislike",
    "✊ fist", "👊 punch fist bump", "🤛 left fist", "🤜 right fist", "👏 clap applause", "🙌 hooray raise hands",
    "👐 open hands", "🤲 palms up", "🤝 handshake deal", "🙏 pray thanks please", "✍️ writing", "💪 strong muscle flex",
    "👀 eyes look see", "🧠 brain smart", "👂 ear listen", "👶 baby", "🧒 child", "👦 boy", "👧 girl", "🧑 person",
    "👨 man", "👩 woman", "🧓 older person", "👴 old man", "👵 old woman", "🙋 raise hand", "🤷 shrug",
    "🤦 facepalm", "🙅 no gesture", "🙆 ok gesture", "💁 tipping hand", "🏇 jockey horse racing", "🏃 runner run",
    "🚶 walk", "🧍 standing", "👯 dancers", "💃 dance woman", "🕺 dance man", "👪 family", "🫂 hug people",
  ],
  Animals: [
    "🐎 horse racehorse", "🐴 horse-face horse", "🦄 unicorn", "🫏 donkey", "🐐 goat", "🐑 sheep", "🐄 cow", "🐖 pig",
    "🐓 rooster", "🐕 dog", "🐶 dog face puppy", "🐩 poodle", "🐈 cat", "🐱 cat face", "🐇 rabbit", "🦊 fox",
    "🐻 bear", "🐼 panda", "🐨 koala", "🐯 tiger", "🦁 lion", "🐮 cow face", "🐷 pig face", "🐸 frog",
    "🐵 monkey", "🙈 see no evil", "🙉 hear no evil", "🙊 speak no evil", "🐔 chicken", "🐧 penguin", "🐦 bird", "🦅 eagle",
    "🦆 duck", "🦉 owl", "🐝 bee", "🦋 butterfly", "🐌 snail", "🐞 ladybug", "🐢 turtle", "🐍 snake",
    "🐟 fish", "🐬 dolphin", "🐳 whale", "🦈 shark", "🐾 paw prints", "🌵 cactus", "🌲 tree evergreen", "🌳 tree",
    "🍀 four leaf clover luck", "☘️ shamrock", "🌿 herb", "🌾 hay rice grain", "🌷 tulip", "🌹 rose", "🌻 sunflower", "🌸 blossom",
  ],
  Food: [
    "🍎 apple", "🍏 green apple", "🥕 carrot", "🍌 banana", "🍉 watermelon", "🍇 grapes", "🍓 strawberry", "🍒 cherries",
    "🍑 peach", "🍍 pineapple", "🥝 kiwi", "🍋 lemon", "🍊 orange", "🌽 corn", "🥔 potato", "🍞 bread",
    "🥐 croissant", "🥯 bagel", "🧀 cheese", "🥚 egg", "🍳 cooking breakfast", "🥓 bacon", "🍔 burger", "🍟 fries",
    "🍕 pizza", "🌭 hot dog", "🥪 sandwich", "🌮 taco", "🌯 burrito", "🥗 salad", "🍝 pasta", "🍜 noodles",
    "🍣 sushi", "🍰 cake", "🎂 birthday cake", "🧁 cupcake", "🍪 cookie", "🍫 chocolate", "🍩 donut", "🍿 popcorn",
    "☕ coffee", "🍵 tea", "🥤 drink soda", "🧃 juice", "🍺 beer", "🍻 cheers beers", "🥂 champagne toast cheers", "🍷 wine",
    "🥃 whisky", "🍸 cocktail", "🍾 bottle celebrate", "🧊 ice",
  ],
  Activity: [
    "🏆 trophy win winner cup", "🥇 gold first medal", "🥈 silver second", "🥉 bronze third", "🏅 medal", "🎖️ military medal",
    "🎯 target bullseye", "🎲 dice luck", "🃏 joker card", "🎰 slot", "🎮 game", "🎳 bowling", "⚽ soccer football",
    "🏀 basketball", "🏈 american football", "⚾ baseball", "🎾 tennis", "🏐 volleyball", "🏉 rugby", "⛳ golf", "🏏 cricket",
    "🥊 boxing", "🏁 finish flag chequered race", "🚩 red flag", "🎉 party tada celebrate", "🎊 confetti", "🎈 balloon",
    "🎁 gift present", "🎟️ ticket admission", "🎫 ticket", "🎤 microphone", "🎧 headphones", "🎵 music note", "🎶 music",
    "🎬 film", "📸 camera photo", "🏟️ stadium", "🎪 circus tent",
  ],
  Travel: [
    "🚗 car", "🚕 taxi", "🚙 suv", "🚚 truck", "🚛 lorry horsebox", "🚜 tractor", "🚲 bike", "🛵 scooter",
    "🚌 bus", "🚆 train", "✈️ plane flight", "🚁 helicopter", "⛵ sailboat", "🚀 rocket", "🗺️ map", "📍 pin location",
    "🏠 house home", "🏡 house garden", "🏢 office", "🏥 hospital vet", "🏨 hotel", "⛪ church", "🌅 sunrise", "🌄 mountain sunrise",
    "🌇 sunset city", "🌙 moon night", "⭐ star", "🌟 glowing star", "☀️ sun sunny", "⛅ partly cloudy", "☁️ cloud", "🌧️ rain",
    "⛈️ storm thunder", "🌈 rainbow", "❄️ snow", "🌬️ wind", "💧 drop water", "🔥 fire hot lit",
  ],
  Objects: [
    "⌚ watch", "⏱️ stopwatch timer", "⏰ alarm clock", "📱 phone", "💻 laptop", "🖥️ computer", "⌨️ keyboard", "🖨️ printer",
    "📷 camera", "📹 video camera", "📺 tv", "📻 radio", "🔔 bell", "📣 megaphone", "📢 loudspeaker", "💡 idea bulb",
    "🔦 torch", "📖 book", "📚 books", "📝 memo note", "✏️ pencil", "🖊️ pen", "📎 paperclip", "📌 pushpin",
    "📅 calendar", "📆 date", "🗓️ calendar spiral", "📊 chart bar", "📈 chart up", "📉 chart down", "🧾 receipt", "💰 money bag",
    "💵 dollar", "💳 card", "🧳 luggage", "🔑 key", "🔒 lock", "🔓 unlock", "🧰 toolbox", "🔧 wrench",
    "🔨 hammer", "🪣 bucket", "🧹 broom", "🩺 stethoscope vet", "💊 pill medicine", "🩹 bandage", "🧪 test tube", "🎀 ribbon",
  ],
  Symbols: [
    "❤️ red heart love", "🧡 orange heart", "💛 yellow heart", "💚 green heart", "💙 blue heart", "💜 purple heart",
    "🖤 black heart", "🤍 white heart", "🤎 brown heart", "💔 broken heart", "❣️ heart exclamation", "💕 two hearts",
    "💖 sparkling heart", "💯 hundred perfect", "✅ check yes done", "☑️ checkbox", "✔️ check mark", "❌ cross no wrong",
    "❎ cross box", "➕ plus", "➖ minus", "❓ question", "❗ exclamation", "‼️ double exclamation", "⚠️ warning",
    "🚫 prohibited no", "⛔ no entry", "🆗 ok button", "🆕 new", "🆒 cool", "🔝 top", "🔜 soon", "⬆️ up arrow",
    "⬇️ down arrow", "➡️ right arrow", "⬅️ left arrow", "🔄 repeat refresh", "♻️ recycle", "✨ sparkles", "💫 dizzy star",
    "💥 boom collision", "💤 zzz sleep", "💬 speech bubble chat", "💭 thought", "🔴 red circle", "🟢 green circle",
    "🟡 yellow circle", "🔵 blue circle", "🟣 purple circle", "⚫ black circle", "⚪ white circle",
  ],
};

export interface EmojiEntry {
  emoji: string;
  /** Search words. */
  words: string;
  /** A unique, readable name for the button ("thumbs up", "thumbs down"). */
  label: string;
}

const parsed = Object.entries(RAW).map(([name, list]) => ({
  name,
  items: list.map((line) => {
    const space = line.indexOf(" ");
    return { emoji: line.slice(0, space), words: line.slice(space + 1) };
  }),
}));
// Shortest run of leading words that no other emoji shares.
const everyWords = parsed.flatMap((c) => c.items.map((i) => i.words.split(" ").map((w) => w.replace(/-/g, " "))));
function labelFor(words: string[]): string {
  for (let n = 1; n <= words.length; n++) {
    const prefix = words.slice(0, n).join(" ");
    if (everyWords.filter((w) => w.slice(0, n).join(" ") === prefix).length === 1) return prefix;
  }
  return words.join(" ");
}

export const EMOJI_CATEGORIES: { name: string; icon: string; items: EmojiEntry[] }[] = parsed.map((c) => ({
  name: c.name,
  icon: c.items[0].emoji,
  items: c.items.map((i) => ({ ...i, label: labelFor(i.words.split(" ").map((w) => w.replace(/-/g, " "))) })),
}));
export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.items);
