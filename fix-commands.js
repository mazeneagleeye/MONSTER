const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, 'commands');
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

let fixedCount = 0;

for (const file of files) {
  const filePath = path.join(commandsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Fix pattern: .addSubcommand(sub => sub\n      .setName(
  // Replace with: .addSubcommand(sub => {\n      sub\n        .setName(
  // And add return sub; before the closing })
  
  // This regex finds addSubcommand patterns and fixes them
  content = content.replace(
    /\.addSubcommand\(sub => sub\n(\s+)\.setName\(/g,
    '.addSubcommand(sub => {\n$1sub\n$1.setName('
  );
  
  // Add return sub; before the closing parenthesis of each addSubcommand
  // This is more complex - we need to find the pattern and add return
  content = content.replace(
    /(\.addSubcommand\(sub => \{\n\s+sub\n(?:\s+\.\w+\(.*\n)*?\s+)\)\)/g,
    (match, contentBefore) => {
      return contentBefore + ';\n      return sub;\n    })';
    }
  );
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files!`);