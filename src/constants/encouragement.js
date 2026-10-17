const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const GENERIC = [
  "Nice work, {name}! Another one in the books. 💪",
  "Smooth pickup! Keep that momentum going. 🚀",
  "Every lead counts — thank you for the great work today. 🌟",
  "Neat, complete records make everyone's job easier. Well done! ✅",
  "You're doing brilliantly, {name}. Keep it up! 👏",
  "Another happy customer, another lead logged. Excellent! 😊",
];

const MILESTONES = {
  1: "Great start, {name}! First lead of the day is in. 🚀",
  3: "Hat-trick! Three leads today — you're on a roll! 🎯",
  5: "High five! Five leads today. Outstanding work! 🙌",
  10: "Double digits! Ten leads today — you're on fire! 🔥",
  15: "Fifteen leads in a day — that's champion level, {name}! 🏆",
  20: "Twenty leads today. Absolutely unstoppable! 👑",
};

export function getEncouragement(name, todayCount) {
  const template = MILESTONES[todayCount] || pick(GENERIC);
  return template.replace("{name}", name || "there");
}
