import { Command } from 'commander';
import { initCommand } from './commands/init';
import { doctorCommand } from './commands/doctor';
import { rankerCommands } from './commands/ranker';
import { rankerExportCommand } from './commands/rankerExport';
import { rankerAddPairCommand } from './commands/rankerAddPair';
import { rankerIngestCommands } from './commands/rankerIngest';
import { rankerScoreCommands, rankerDumpCommands } from './commands/rankerScore';

export function setupCommands(program: Command): void {
  // Core commands
  program.addCommand(initCommand());
  program.addCommand(doctorCommand());

  // Ranker commands
  const rankerCommand = rankerCommands();
  rankerCommand.addCommand(rankerExportCommand());
  rankerCommand.addCommand(rankerAddPairCommand());
  rankerCommand.addCommand(rankerIngestCommands());
  rankerCommand.addCommand(rankerScoreCommands());
  rankerCommand.addCommand(rankerDumpCommands());
  program.addCommand(rankerCommand);
}