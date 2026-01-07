import { Command } from 'commander';
import { initCommand } from './commands/init';
import { doctorCommand } from './commands/doctor';
import { factsCommands } from './commands/facts';
import { profileCommands } from './commands/profile';
import { llmCommands } from './commands/llm';
import { githubCommands } from './commands/github';
import { linkedinCommands } from './commands/linkedin';
import { resumeCommands } from './commands/resume';
import { coverletterCommands } from './commands/coverletter';
import { jobCommands } from './commands/job';
import { benchmarksCommands } from './commands/benchmarks';
import { rankerCommands } from './commands/ranker';
import { rankerExportCommand } from './commands/rankerExport';
import { rankerAddPairCommand } from './commands/rankerAddPair';

export function setupCommands(program: Command): void {
  // Core commands
  program.addCommand(initCommand());
  program.addCommand(doctorCommand());

  // Fact store commands
  program.addCommand(factsCommands());

  // Profile commands
  program.addCommand(profileCommands());

  // LLM commands
  program.addCommand(llmCommands());

  // Platform-specific commands
  program.addCommand(githubCommands());
  program.addCommand(linkedinCommands());

  // Document generation commands
  program.addCommand(resumeCommands());
  program.addCommand(coverletterCommands());

  // Job matching commands
  program.addCommand(jobCommands());

  // Benchmark library commands
  program.addCommand(benchmarksCommands());

  // Ranker commands
  const rankerCommand = rankerCommands();
  rankerCommand.addCommand(rankerExportCommand());
  rankerCommand.addCommand(rankerAddPairCommand());
  program.addCommand(rankerCommand);
}