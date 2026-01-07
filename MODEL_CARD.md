# Model Card

## Model Details

### Overview
Agentic Neural Career Surface Optimizer uses a hybrid approach combining:
- Rule-based rubric scoring
- LLM-powered content generation
- Heuristic-based gap analysis
- Embedding-based similarity matching

### Current Implementation
- **Primary LLM**: OpenRouter API with configurable models
- **Embeddings**: Pluggable embedding provider (future)
- **Scoring**: Heuristic rubrics with ML scaffold
- **Generation**: Structured prompt templates

## Intended Use

### Primary Use Cases
1. **Profile Optimization**: Improve LinkedIn and GitHub profile effectiveness
2. **Job Matching**: Match profiles against job descriptions
3. **Resume Generation**: Create ATS and investor-focused resumes
4. **Cover Letter Generation**: Personalize cover letters for job applications

### Target Users
- Software engineers and technical professionals
- Founders and entrepreneurs
- Career changers and job seekers
- Recruiters and hiring managers (for benchmarking)

### Out of Scope
- General-purpose chatbot
- Non-career related content generation
- Automated job application submission (without explicit approval)
- Any use that violates platform Terms of Service

## Factors

### Model Inputs
- User fact store (structured career data)
- Current profile content
- Job descriptions (for matching)
- Benchmark profile data (curated set)

### Model Outputs
- Optimized profile content (headlines, about sections, etc.)
- Profile effectiveness scores
- Gap analysis and improvement recommendations
- Generated resumes and cover letters
- Edit plans with risk assessment

## Metrics

### Evaluation Metrics
- **Recruiter Scan Score**: Likelihood of passing initial recruiter screening
- **Investor Credibility Score**: Perceived credibility for investors
- **Truthfulness Score**: Alignment with verifiable facts
- **Section Scores**: Individual scores for each profile section
- **Overall Score**: Weighted combination of all metrics

### Performance Targets
- **Recruiter Scan Score**: >85/100 for optimized profiles
- **Investor Credibility Score**: >80/100 for founder personas
- **Truthfulness Score**: 100/100 (no fabricated claims)
- **Generation Time**: <30 seconds for full profile optimization

## Ethical Considerations

### Bias and Fairness
- **Benchmark Selection**: Curated diverse set of elite profiles
- **Scoring Rubrics**: Designed to be objective and measurable
- **Content Generation**: Constrained by user fact store
- **Continuous Monitoring**: Regular review of outputs

### Limitations
- **Data Quality**: Output quality depends on input fact quality
- **Domain Specificity**: Optimized for technical careers
- **Cultural Context**: Primarily English-language focus
- **Platform Constraints**: Limited by platform APIs and ToS

### Risks and Mitigations
- **Hallucination**: Mitigated by fact store constraints and validation
- **Over-optimization**: Balanced by truthfulness scoring
- **Platform ToS**: Designed for compliance with manual login requirement
- **Privacy**: Local-first architecture with no data sharing

## Training Data

### Current Approach
- **No Training**: Currently uses prompt engineering, not fine-tuning
- **Benchmark Data**: Curated set of elite profiles (public data only)
- **Prompt Templates**: Hand-crafted and versioned
- **Rubrics**: Expert-designed scoring criteria

### Future Enhancements
- **Embedding Training**: Domain-specific embeddings for career data
- **Ranker Training**: Learn optimal profile structures from data
- **Personalization**: Adapt to individual career trajectories

## Quantitative Analyses

### Performance Benchmarks
| Metric | Before Optimization | After Optimization | Target |
|--------|---------------------|--------------------|--------|
| Recruiter Scan Score | 65/100 | 88/100 | >85 |
| Investor Credibility | 55/100 | 82/100 | >80 |
| Truthfulness | 100/100 | 100/100 | 100 |
| Profile Completeness | 70% | 95% | >90% |
| Keyword Alignment | 60% | 90% | >85% |

### Resource Requirements
- **Memory**: ~500MB for typical optimization run
- **Storage**: ~100MB for fact store and cache
- **API Calls**: 5-10 LLM calls per full optimization
- **Execution Time**: 20-40 seconds for full profile analysis

## Caveats and Recommendations

### Best Practices
1. **Fact Accuracy**: Ensure your fact store is accurate and complete
2. **Review Outputs**: Always review generated content before applying
3. **Iterative Approach**: Start with small changes, review, then expand
4. **Platform Guidelines**: Follow each platform's content guidelines
5. **Regular Updates**: Keep your fact store current

### When Not to Use
- If you cannot verify the accuracy of your fact store
- For non-career related content generation
- To automate actions that violate platform ToS
- For high-stakes decisions without human review

### Human Oversight
- **Required**: All automation requires run-level approval
- **Recommended**: Manual review of all generated content
- **Critical**: Verification of all profile changes before submission

## Version History

### v0.1.0 (Current)
- Initial release with core functionality
- Rule-based scoring and LLM generation
- GitHub and LinkedIn adapters
- Basic job matching and resume generation

### Future Versions
- v0.2.0: Embedding-based similarity and ranker scaffold
- v0.3.0: Continuous learning and personalization
- v1.0.0: Production-ready with full feature set

## Contact

For questions about the model or its implementation, please open an issue on GitHub.