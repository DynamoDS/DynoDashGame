export interface TriviaQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
}

export const QUESTIONS: TriviaQuestion[] = [
  {
    question: "Why is your geometry preview empty?",
    options: {
      A: "Dynamo is shy",
      B: "You forgot to turn on preview",
      C: "Your data is null somewhere upstream",
      D: "Revit is judging you",
    },
    correct: "C",
  },
  {
    // options A↔B swapped — correct moved from B to A
    question: "You used List.Flatten and everything broke. Why?",
    options: {
      A: "You destroyed important list structure",
      B: "Flatten is evil",
      C: "Dynamo hates efficiency",
      D: "Too many nodes",
    },
    correct: "A",
  },
  {
    // options B↔D swapped — correct moved from B to D
    question: "What's the real difference between List.Map and List.Combine?",
    options: {
      A: "None, just vibes",
      B: "Map is faster",
      C: "Combine is deprecated",
      D: "Map = single list, Combine = multiple lists + function",
    },
    correct: "D",
  },
  {
    question: "Your node works… until you feed it a list. What happened?",
    options: {
      A: "Dynamo changed overnight",
      B: "You angered the lacing gods",
      C: "The node wasn't designed for lists / needs replication handling",
      D: "You need more RAM",
    },
    correct: "C",
  },
  {
    // options A↔B swapped — correct moved from B to A
    question: "What does \"Cross Product\" lacing do?",
    options: {
      A: "Creates all possible combinations of inputs",
      B: "Multiplies numbers",
      C: "Breaks your graph",
      D: "Calls Jacob Small",
    },
    correct: "A",
  },
  {
    // options A↔C swapped — correct moved from C to A
    question: "You see null values everywhere. Best next step?",
    options: {
      A: "Trace upstream and validate inputs",
      B: "Restart Dynamo",
      C: "Ignore them",
      D: "Accept your fate",
    },
    correct: "A",
  },
  {
    // options B↔D swapped — correct moved from B to D
    question: "Why is List.Chop safer than List.Split sometimes?",
    options: {
      A: "It sounds cooler",
      B: "Split is deprecated",
      C: "Chop is faster",
      D: "Chop uses fixed chunk sizes, Split depends on indices and can misalign data",
    },
    correct: "D",
  },
  {
    // options A↔B swapped — correct moved from B to A
    question: "You used @L2 but output is wrong. Why?",
    options: {
      A: "Your data structure isn't what you think it is",
      B: "Levels are a myth",
      C: "Dynamo bug",
      D: "Needs more nodes",
    },
    correct: "A",
  },
  {
    // options C↔D swapped — correct moved from C to D
    question: "What is the danger of List.Flatten(-1)?",
    options: {
      A: "Nothing",
      B: "It flattens only one level",
      C: "It deletes your graph",
      D: "It completely nukes all hierarchy",
    },
    correct: "D",
  },
  {
    // options B↔D swapped — correct moved from B to D
    question: "Why does your Python node \"work\" but output nothing useful?",
    options: {
      A: "Python is broken",
      B: "Needs more imports",
      C: "Indentation is optional",
      D: "You forgot to assign to OUT",
    },
    correct: "D",
  },
  {
    question: "\"My graph worked yesterday.\" What changed?",
    options: {
      A: "Dynamo auto-updated",
      B: "Revit version changed",
      C: "Your inputs / environment changed",
      D: "Ghosts",
    },
    correct: "C",
  },
  {
    // options A↔B swapped — correct moved from B to A
    question: "What does replication do?",
    options: {
      A: "Iterates functions over list structures automatically",
      B: "Copies nodes",
      C: "Runs loops manually",
      D: "Converts data types",
    },
    correct: "A",
  },
  {
    question: "Why are too many Watch nodes bad?",
    options: {
      A: "It's not",
      B: "Performance hit + slows graph execution",
      C: "Causes crashes",
      D: "Breaks lists",
    },
    correct: "B",
  },
  {
    // options B↔D swapped — correct moved from B to D
    question: "Biggest beginner mistake with lists?",
    options: {
      A: "Not using enough nodes",
      B: "Naming things badly",
      C: "Using Python too early",
      D: "Ignoring list structure and levels",
    },
    correct: "D",
  },
  {
    question: "Why did List.Transpose break things?",
    options: {
      A: "Transpose is random",
      B: "Your sublists weren't aligned in length",
      C: "Dynamo bug",
      D: "You needed Flatten first",
    },
    correct: "B",
  },
  {
    question: "Why does == sometimes fail?",
    options: {
      A: "It's cursed",
      B: "Floating point precision issues",
      C: "Dynamo lies",
      D: "Lists are emotional",
    },
    correct: "B",
  },
  {
    // options A↔B swapped — correct moved from B to A
    question: "What is List@Level really for?",
    options: {
      A: "Precise control over which list depth a function applies to",
      B: "Decoration",
      C: "Debugging only",
      D: "Performance boost",
    },
    correct: "A",
  },
  {
    question: "Why is your graph slow?",
    options: {
      A: "Dynamo is slow",
      B: "Too many previews + large data sets + inefficient nodes",
      C: "Bad internet",
      D: "You need a GPU",
    },
    correct: "B",
  },
  {
    // options B↔D swapped — correct moved from B to D
    question: "Why do groups \"feel\" like they help?",
    options: {
      A: "It fixed the graph",
      B: "Dynamo respects organization",
      C: "Groups improve performance",
      D: "It didn't — but now you understand it better",
    },
    correct: "D",
  },
  {
    question: "Final boss: What solves most Dynamo problems?",
    options: {
      A: "Add more nodes",
      B: "Rewrite in Python",
      C: "Understand your data structure",
      D: "Panic and ask the forum",
    },
    correct: "C",
  },
];
