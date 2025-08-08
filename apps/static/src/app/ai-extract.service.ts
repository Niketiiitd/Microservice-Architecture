import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import fetch from 'node-fetch';

@Injectable()
export class AiExtractService {
  async extractResumeInfo(text: string): Promise<any> {
    if (!text) {
      throw new BadRequestException('No text provided');
    }
    console.log("Text to be sent to OpenRouter:", text);
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('OPENROUTER_API_KEY not set');
    }

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.2-3b-instruct:free",
        messages: [
          { role: "user", content: `Give the resume information in text I want you to extract these details from the resume

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
            `},
          { role: "assistant", content: text },
        ],
      }),
    });

    const aiResult: any = await aiResponse.json();
    console.log("AI Result:", aiResult);
    if (aiResult?.error?.message === "Provider returned error" && aiResult?.error?.code === 401) {
      throw new UnauthorizedException('Unauthorized');
    }

    const structuredContent = aiResult?.choices?.[0]?.message?.content || "";
    const jsonMatch = structuredContent.match(/```json([\s\S]*?)```/);
    const structuredData = jsonMatch ? JSON.parse(jsonMatch[1].trim()) : {};

    return structuredData;
  }
}
