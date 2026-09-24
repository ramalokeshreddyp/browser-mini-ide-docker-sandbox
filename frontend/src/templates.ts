import { ProjectTemplate } from './types';

export const STARTER_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'python-script',
    testId: 'template-python-script',
    name: 'Python Multi-File Math & Greetings',
    language: 'python',
    description: 'Modular Python application demonstrating local imports and math algorithms.',
    files: [
      {
        path: 'main.py',
        content: `import time
from utils import greet
from math_ops import fibonacci, is_prime

print("=== Starting Python Modular Execution ===")
print(greet("Developer"))

print("\\nCalculating first 10 Fibonacci numbers:")
for i in range(1, 11):
    print(f"Fib({i}) = {fibonacci(i)}")

print("\\nPrime check demo:")
numbers = [2, 3, 4, 17, 20, 29]
for n in numbers:
    print(f"Is {n} prime? {is_prime(n)}")

print("\\nSimulating multi-step task...")
for step in range(1, 4):
    print(f"Step {step}/3 completed.")
    time.sleep(0.3)

print("=== Python Execution Finished Successfully ===")
`,
      },
      {
        path: 'utils.py',
        content: `def greet(name: str) -> str:
    """Returns a friendly formatted greeting."""
    return f"Hello, {name}! Welcome to the Sandboxed Mini IDE."
`,
      },
      {
        path: 'math_ops.py',
        content: `def fibonacci(n: int) -> int:
    """Calculate the n-th Fibonacci number."""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b


def is_prime(n: int) -> bool:
    """Check if a number is prime."""
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True
`,
      },
    ],
  },
  {
    id: 'python-api',
    testId: 'template-python-api',
    name: 'Python Data Processing Pipeline',
    language: 'python',
    description: 'Multi-module data transformation and statistics pipeline in Python.',
    files: [
      {
        path: 'main.py',
        content: `from pipeline import run_pipeline
from dataset import SAMPLE_USERS

def main():
    print("=== Running Data Processing Pipeline ===")
    results = run_pipeline(SAMPLE_USERS)
    print("\\nPipeline Results:")
    print(f"Total Users: {results['total']}")
    print(f"Average Score: {results['avg_score']:.2f}")
    print(f"Top Performer: {results['top_performer']['name']} ({results['top_performer']['score']})")

if __name__ == "__main__":
    main()
`,
      },
      {
        path: 'dataset.py',
        content: `SAMPLE_USERS = [
    {"name": "Alice", "score": 92, "active": True},
    {"name": "Bob", "score": 78, "active": True},
    {"name": "Charlie", "score": 85, "active": False},
    {"name": "Diana", "score": 98, "active": True},
    {"name": "Evan", "score": 64, "active": True},
]
`,
      },
      {
        path: 'pipeline.py',
        content: `def run_pipeline(users):
    active_users = [u for u in users if u.get("active", False)]
    scores = [u["score"] for u in active_users]
    avg = sum(scores) / len(scores) if scores else 0
    top = max(active_users, key=lambda u: u["score"]) if active_users else None

    return {
        "total": len(active_users),
        "avg_score": avg,
        "top_performer": top
    }
`,
      },
    ],
  },
  {
    id: 'js-cli',
    testId: 'template-js-cli',
    name: 'JavaScript / Node.js Modular CLI',
    language: 'javascript',
    description: 'Modern ES-Module Node.js project demonstrating multi-file imports and string formatting.',
    files: [
      {
        path: 'index.js',
        content: `import { greet, formatHeader } from './utils.js';
import { calculateStats, formatCurrency } from './stats.js';

console.log(formatHeader('Node.js Sandboxed Project'));
console.log(greet('World'));

const sales = [120.5, 450.0, 89.9, 320.0, 95.5];
const stats = calculateStats(sales);

console.log('\\n--- Sales Summary ---');
console.log(\`Transactions: \${stats.count}\`);
console.log(\`Total Sales: \${formatCurrency(stats.total)}\`);
console.log(\`Average Ticket: \${formatCurrency(stats.average)}\`);
console.log(\`Highest Sale: \${formatCurrency(stats.max)}\`);
console.log('\\nExecution completed successfully.');
`,
      },
      {
        path: 'utils.js',
        content: `export const greet = (name) => {
  return \`Hello, \${name}!\`;
};

export const formatHeader = (title) => {
  const line = '='.repeat(title.length + 8);
  return \`\${line}\\n=== \${title} ===\\n\${line}\`;
};
`,
      },
      {
        path: 'stats.js',
        content: `export function calculateStats(numbers) {
  if (!numbers || numbers.length === 0) {
    return { count: 0, total: 0, average: 0, max: 0 };
  }
  const total = numbers.reduce((acc, curr) => acc + curr, 0);
  const average = total / numbers.length;
  const max = Math.max(...numbers);

  return {
    count: numbers.length,
    total,
    average,
    max,
  };
}

export function formatCurrency(val) {
  return '$' + val.toFixed(2);
}
`,
      },
      {
        path: 'package.json',
        content: `{
  "name": "js-sandbox-app",
  "version": "1.0.0",
  "type": "module",
  "description": "ES Module Node.js Project"
}
`,
      },
    ],
  },
];
