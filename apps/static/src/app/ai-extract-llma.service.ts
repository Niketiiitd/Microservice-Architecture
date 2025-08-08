import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
// Removed static import to use dynamic import in the function instead.

@Injectable()
export class AiExtractLlamaService {
  async extractResumeInfo(text: string): Promise<any> {
    const { default: fetch } = await import('node-fetch');
    if (!text) {
      throw new BadRequestException('No text provided');
    }
    console.log("Text to be sent to Ollama:", text);

    // You can change the model name if you use a different one in Ollama
    const model = 'mistral';

    // The prompt for the LLM
    const prompt = `
Give the resume information in text I want you to extract these details from the resume

FirstName:
LastName:
Address: {
Country:
Street Address:
City:
State/Province:
Zip Code:
}
Work Experience: [{
Company:
Role:
Location:
Start Date (MM/dd/yyyy):
End Date (MM/dd/yyyy):
Description:
}]
Education: [
{
University Name:
Degree Type:
Major:
GPA:
Start Date (MM/dd/yyyy):
End Date (MM/dd/yyyy):
}
]

I want you to give me the output in json format and only fill fields that you are confident about from the data given dont make up anything

Resume Text:
${text}
`;

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`Ollama server error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = (data as any)?.response || '';

    // Try to extract JSON from the response
    let structuredData = {};
    try {
      const jsonMatch = content.match(/```json([\s\S]*?)```/);
      structuredData = jsonMatch ? JSON.parse(jsonMatch[1].trim()) : JSON.parse(content);
    } catch (e) {
      structuredData = { raw: content };
    }

    return structuredData;
  }
}
