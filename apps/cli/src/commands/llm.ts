import { Command } from 'commander';
import chalk from 'chalk';
import { OpenRouterClient } from '@ancso/llm';
import { getConfig } from '@ancso/core';

export function llmCommands(): Command {
  const command = new Command('llm')
    .description('LLM-related commands')
    .addCommand(new Command('test')
      .description('Test OpenRouter API connectivity')
      .action(async () => {
        console.log(chalk.blue('Testing OpenRouter API connectivity...'));

        try {
          const config = getConfig();
          const client = new OpenRouterClient();

          console.log(`🔑 Using model: ${config.OPENROUTER_DEFAULT_MODEL}`);

          const response = await client.chatCompletion({
            model: config.OPENROUTER_DEFAULT_MODEL,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.',
              },
              {
                role: 'user',
                content: 'Hello, this is a test message from Agentic Neural Career Surface Optimizer.',
              },
            ],
          });

          const content = response.choices[0].message.content;
          console.log('✅ API test successful!');
          console.log(`💬 Response: ${content}`);
          console.log(`📊 Tokens used: ${response.usage?.total_tokens || 'unknown'}`);

        } catch (error) {
          console.error(chalk.red('API test failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('generate')
      .description('Generate content using LLM')
      .argument('<prompt>', 'Prompt to send to LLM')
      .option('-m, --model <model>', 'Specific model to use')
      .action(async (prompt, options) => {
        console.log(chalk.blue(`Generating content for prompt: "${prompt}"`));

        try {
          const config = getConfig();
          const client = new OpenRouterClient();

          const model = options.model || config.OPENROUTER_DEFAULT_MODEL;
          console.log(`🔑 Using model: ${model}`);

          const response = await client.chatCompletion({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful career optimization assistant.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
          });

          const content = response.choices[0].message.content;
          console.log('✅ Generation successful!');
          console.log(`📄 Result:\n${content}`);
          console.log(`📊 Tokens used: ${response.usage?.total_tokens || 'unknown'}`);

        } catch (error) {
          console.error(chalk.red('Generation failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }));

  return command;
}