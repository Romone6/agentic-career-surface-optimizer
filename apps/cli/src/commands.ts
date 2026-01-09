import { Command } from 'commander';
import { initCommand } from './commands/init';
import { doctorCommand } from './commands/doctor';
import { rankerIngestCommands } from './commands/rankerIngest';
import { rankerScoreCommands, rankerDumpCommands } from './commands/rankerScore';

export function setupCommands(program: Command): void {
  program.addCommand(initCommand());
  program.addCommand(doctorCommand());
  
  const rankerCommand = new Command('ranker')
    .description('Ranker model management commands');
  
  rankerCommand.addCommand(rankerIngestCommands());
  rankerCommand.addCommand(rankerScoreCommands());
  rankerCommand.addCommand(rankerDumpCommands());
  
  program.addCommand(rankerCommand);
}