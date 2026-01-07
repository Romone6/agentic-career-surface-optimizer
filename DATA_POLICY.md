# Data Policy

## What We Collect

### User-Provided Data
- **Profile Information**: Name, title, contact information (only what you choose to optimize)
- **Career History**: Job titles, companies, dates, responsibilities
- **Education**: Degrees, institutions, dates
- **Projects**: Project names, descriptions, links
- **Skills**: Technical and soft skills

### Automatically Collected Data
- **Usage Data**: CLI commands run, timestamps, success/failure
- **Performance Data**: Execution times, memory usage
- **Error Data**: Error messages, stack traces (sanitized)

### What We Don't Collect
- **No passwords or credentials**
- **No financial information**
- **No personal identification numbers**
- **No health or medical information**
- **No browsing history outside of profile optimization**

## How We Use Data

### Primary Uses
- **Profile Optimization**: To generate optimized profile content
- **Scoring**: To calculate profile effectiveness scores
- **Learning**: To improve optimization algorithms (local-only)
- **Personalization**: To tailor recommendations to your career goals

### What We Don't Do
- **No sharing**: Data never leaves your machine
- **No selling**: Data is never sold or monetized
- **No advertising**: Data is never used for targeted advertising
- **No tracking**: No cross-site tracking or analytics

## Data Storage

### Local Storage
- **SQLite Database**: All structured data stored in local SQLite database
- **File System**: Generated content and cache stored in local files
- **Location**: All data stored in `./data` directory by default

### Data Retention
- **User Control**: You can delete data at any time
- **No Automatic Deletion**: Data persists until you delete it
- **Backup Responsibility**: You are responsible for backups

### Security Measures
- **File Permissions**: Database files have restricted permissions
- **Encryption**: Future enhancement for sensitive data
- **Access Control**: Only accessible to your user account

## Data Access

### Who Can Access Your Data
- **You**: Full access via CLI and file system
- **No One Else**: Data never transmitted or shared

### How to Access Your Data
```bash
# View your fact store
pnpm run facts:show

# Export your data
pnpm run data:export

# Delete your data
pnpm run data:reset
```

## Data Deletion

### How to Delete Your Data

1. **Selective Deletion**: Delete specific facts or artifacts
   ```bash
   pnpm run facts:edit
   ```

2. **Full Reset**: Delete all data
   ```bash
   rm -rf ./data
   ```

3. **Cache Clear**: Clear cached LLM responses
   ```bash
   rm -rf ./cache
   ```

## Third-Party Services

### OpenRouter
- **Purpose**: LLM API for content generation
- **Data Sent**: Only sanitized prompts and context
- **Data Received**: Generated content and metadata
- **Privacy**: OpenRouter's privacy policy applies to their service

### GitHub
- **Purpose**: Profile README updates and repository management
- **Data Sent**: OAuth tokens, repository content
- **Data Received**: Repository data, user profile
- **Privacy**: GitHub's privacy policy applies

### LinkedIn (via Browser Automation)
- **Purpose**: Profile updates within your logged-in session
- **Data Sent**: Form data via browser automation
- **Data Received**: Profile data visible in your session
- **Privacy**: LinkedIn's privacy policy applies

## Children's Privacy

This software is not intended for use by children under 13. We do not knowingly collect data from children.

## Changes to This Policy

This policy may be updated as the software evolves. Changes will be documented in the changelog.

## Contact

For questions about this data policy, please open an issue on GitHub.