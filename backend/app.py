import os
from dotenv import load_dotenv
import google.generativeai as oldgenai
from google import genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import requests
# from selenium import webdriver
# from selenium.webdriver.chrome.options import Options
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC
import bs4
import time
import json
import os
import ast
import re
from io import BytesIO


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins

load_dotenv()
# CHROMEDRIVER_PATH = r"./driver/chromedriver.exe"
# options = Options()
# options.headless = True
# driver = webdriver.Chrome(options=options)

ALGORITHMS_BASE_URL = "https://leetcode.com/problems/"

def main_extractor(language, response):
    sections = {
        "Code": [],
        "Space_Complexity": [],
        "Improvements": [],
        "Time_Complexity": [],
        "Logic": []
    }
    section_markers = {
        '**Space Complexity:**': "Space_Complexity",
        '**Improvements/Alternatives:**': "Improvements",
        '**Time Complexity:**': "Time_Complexity",
        '**Logic:**': "Logic",
        '```': "Code"
    }
    print("Response: ",response.text,"\n")
    
    current_section = None
    is_code_section = False

    for line in response.text.split('\n'):
        line_stripped = line.strip()
        print("stripped",line_stripped,"\n")
        if section_markers in line_stripped:
            section_name = section_markers[line_stripped]
            print("identified: ",section_name,"\n\n")
            if section_name == "Code":
                is_code_section = not is_code_section
                current_section = "Code" if is_code_section else None
            else:
                current_section = section_name

            continue

        if current_section:
            sections[current_section].append(line)

    for key in sections:
        sections[key] = "\n".join(sections[key])

    is_code_section = False
    sections['Code'] = [f"```{language}"]
    for line in response.text.split('\n'):
        if line.strip().startswith('```'):
            is_code_section = not is_code_section
            continue

        if is_code_section:
            sections['Code'].append(line)

    sections["Code"] = "\n".join(sections["Code"])
    sections['Code'] += '\n```'
    # print("final: \n",sections,"\n\n\n\n")
    return sections

def filter_response(response_text):
    phrases_to_remove = [
        "Let me know if you'd like to explore any specific aspect of the code in more detail.",
        "Let's delve into",
        "Feel free to ask if",
        "I hope this helps",
    ]
    for phrase in phrases_to_remove:
        response_text = response_text.replace(phrase, "").strip()
    return response_text

def final_parser(chat_sessions, structured_output):
    content = {
        "Codes": {
            "Python": "",
            "C++": "",
            "Java": ""
        },
        "Space_Complexity": "",
        "Improvements": "",
        "Time_Complexity": "",
        "Logic": ""
    }

    for language, value in structured_output.items():
        for key, value1 in value.items():
            if key != "Code":
                content[key] = filter_response(value1)
        content["Codes"][language] = filter_response(value["Code"])

    for key, value in content.items():
        if not value:
            print(key,"missing keys hence seperate calls")
            content[key] = filter_response(
                chat_sessions["Python"].send_message(
                    f"Can you discuss a little about {key} of the code? Please respond in a concise, non-conversational format."
                ).text
            )
    print("everything parsed")
    return content

# Configure API key for Gemini
oldgenai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Languages to generate solutions for
languages = ["Python", "C++", "Java"]

# Create the model configuration
generation_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# Initialize the model
model = oldgenai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config,
)

chat_sessions = {}
@app.route('/answer', methods=['POST'])
def solve():
    try:
        user_input = request.json.get("problemStatement", "")
        if not user_input:
            return jsonify({"error": "Problem statement is required."}), 400

        # JSON Schema (escaped properly)
        json_schema = '''{
            "Code": "string",
            "Logic": "string",
            "Time_Complexity": "string",
            "Space_Complexity": "string",
            "Improvements": "string"
        }'''

        base_problem_statement = f"""
        You are my expert coding instructor. Generate a solution for the following problem in {{language}}.
        The response **MUST** be in JSON format following this schema:

        Problem Statement:
        {user_input}
        """

        structured_output = {}
        languages = {"python"}  # Can be expanded to multiple languages

        for language in languages:
            problem_statement = base_problem_statement.format(language=language)

            # Initialize Gemini client
            chat_session = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
            response = chat_session.models.generate_content(
                model='gemini-2.0-flash',
                contents=problem_statement,
            )

            # Ensure response is valid JSON
            try:
                output = json.loads(response.text.strip("```json").strip("```"))  # Clean Markdown code block
                structured_output[language] = output
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON response from AI"}), 500

        # Wrap the structured output into JSON
        final_response = {"solutions": structured_output}
        return jsonify(final_response), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/answer/query', methods=['GET','POST'])
def answerQuery():
    try:
        follow_up_question = request.json.get("doubt", "")
        language = request.json.get("language", "")
        if not follow_up_question:
            return jsonify({"error": f"Follow Up Question for {language} code is required."}), 400
        print(follow_up_question,language)
        answer = chat_sessions[language].send_message(follow_up_question)
        print("doubt answer:",answer)
        # answer = "**Base Case:** If the input array `arr` has fewer than two elements, it's already sorted and returned.\n\n2. **Pivot Selection:** The first element of the array (`arr[0]`) is chosen as the pivot.  (Note:  This is a simple but potentially inefficient choice;  better pivot selection strategies exist.)\n\n3. **Partitioning:** The remaining elements are partitioned into two sub-arrays: `less` containing elements less than or equal to the pivot, and `greater` containing elements greater than the pivot.  List comprehensions efficiently achieve this partitioning.\n\n"
        return jsonify({"answer":answer.text}), 200
        # return jsonify({"answer":answer}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/answer/refresh', methods=['GET','POST'])
def refreshContent():
    try:
        refreshLang = request.json.get("chat", "")
        section = request.json.get("section", "")
        print("section ",section)
        if not section or not refreshLang:
            return jsonify({"error": f"Refresh Failed"}), 400
        print(refreshLang)
        answer = chat_sessions[refreshLang].send_message(f"Can u generate the {section} section again in a more accurate way. If already accurate then return the same again. If it's the code then strictly only send code.")
        print("refreshed content:",answer.text)
        return jsonify({"content":answer.text,"section":section}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/code', methods=['GET','POST'])
def answerCode():
    try:
        code = request.json.get("code", "")
        if not code:
            return jsonify({"error": f"error"}), 400
        chat_session = model.start_chat(history=[])
        code_query = "Analayze the code and explain in detail"
        code_query += code
        response = chat_session.send_message(code_query)
        # print("doubt answer:",response.text)
        return jsonify({"answer":response.text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/code-query', methods=['POST'])
def answer_code_task():
    try:
        data = request.json
        code = data.get("code", "")
        task = data.get("task", "")

        if not code or not task:
            return jsonify({"error": "Code and task are required."}), 400

        chat_session = model.start_chat(history=[])
        code_query = f"Analyze the following code and solve the task requested in the comment: {task}\n\nCode:\n{code}"

        response = chat_session.send_message(code_query)
        print("Returned code answer:", response.text)

        return jsonify({"answer": response.text}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-code', methods=['POST'])
def analyze_code():
    data = request.json
    code = data.get('code', '')
    language = data.get('language', 'javascript')
    analysis_types = data.get('types', ['errors', 'suggestions', 'explanations'])

    # Initialize response structure
    analysis_result = {
        'errors': [],
        'suggestions': [],
        'explanations': []
    }

    try:
        if language == 'python':
            chat_session = model.start_chat(history=[])
            # Example: Analyze Python code using AST
            try:
                tree = ast.parse(code)
                # Example: Check for unused imports
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            if alias.name not in analysis_result['suggestions']:
                                analysis_result['suggestions'].append({
                                    'line': node.lineno,
                                    'message': f"Unused import: {alias.name}"
                                })
            except SyntaxError as e:
                analysis_result['errors'].append({  
                    'line': e.lineno,
                    'message': f"Syntax error: {e.msg}"
                })
            code_query = f'''Analyze the following {language} code: \n\n {code}\n\n
                            and provide a concise yet informative explanation.\n
                            Act as an expert coding instructor and guide me in refining the implementation. Offer constructive suggestions, best practices, and potential improvements.\n
                            Avoid conversational tones or AI-like phrasing—keep it structured and professional. Do not rewrite the entire code; instead, assist with the next logical steps, highlight possible optimizations, and suggest relevant test cases to validate functionality
                            Respond as if you ar talking to me and teaching me.
                           
                          '''
            explainations = chat_session.send_message(code_query)
            analysis_result["explanations"] = explainations.text
            print(explainations.text)
            

        elif language == 'javascript':
            # Example: Analyze JavaScript code using ESLint (if installed)
            try:
                result = os.subprocess.run(['eslint', '--format', 'json', '--stdin'], input=code.encode(), capture_output=True)
                if result.returncode != 0:
                    errors = json.loads(result.stdout)
                    for error in errors:
                        analysis_result['errors'].append({
                            'line': error['line'],
                            'message': error['message']
                        })
            except Exception as e:
                analysis_result['errors'].append({
                    'line': 1,
                    'message': f"Error analyzing JavaScript code: {str(e)}"
                })
            chat_session = model.start_chat(history=[])
            code_query = f"Analyze the following {language} code:\n\n {code}\n\n and provide a concise explaination for the code."
            explainations = chat_session.send_message(code_query)
            # print("Returned code answer:", analysis.text)
            analysis_result["explanations"] = explainations.text

        # Add more language-specific analysis here...

    except Exception as e:
        analysis_result['errors'].append({
            'line': 1,
            'message': f"Unexpected error during analysis: {str(e)}"
        })

    # Filter results based on requested analysis types
    filtered_result = {key: analysis_result[key] for key in analysis_types if key in analysis_result}

    return jsonify(filtered_result)


# def fetch_problem_data(url):
#     try:
#         driver.get(url)
#         print("yaha kaise")
#         # Wait until the problem content is visible
#         # element = WebDriverWait(driver, 30).until(
#         #     EC.visibility_of_element_located((By.CLASS_NAME, "_1l1MA"))
#         # )
#         html = driver.page_source
#         print(html,"htmlllllllllllll")
#         soup = bs4.BeautifulSoup(html, "html.parser")
        
#         problem_content = str(soup.find("div", {"class": "elfjS"}))
#         print(problem_content,"omggggg")
#         return problem_content  # This will be used to create HTML or EPUB
#     except Exception as e:
#         return f"Failed to fetch problem data: {e}"
    
# @app.route('/fetch-problem', methods=[' GET, POST'])
# def fetch_problem():
#     url = request.json.get("problemLink", "")

#     if not url or "leetcode.com/problems" not in url:
#         return jsonify({"error": "Invalid URL"}), 400
#     print("atleast")
#     try:
#         # Set the User-Agent header to mimic a real browser
#         # headers = {
#         #     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
#         # }

#         # Fetch the page content from LeetCode
#         print("yaha toh poche")
#         problem_data = fetch_problem_data(url)
#         print(problem_data,"waah")
#         # response = requests.get(url, headers=headers)

#         # Check for 403 Forbidden status
#         # if response.status_code != 200:
#         #     return jsonify({"error": f"Failed to fetch the page. Status code: {response.status_code}"}), 500
        
#         # Parse the page content
#         # soup = BeautifulSoup(response.content, 'html.parser')

#         # Extract the problem statement (make sure this class name is correct)
#         # problem_content = soup.find('div', class_='question-content')
#         if problem_data:
#             return jsonify({"problemStatement": problem_data})
#         else:
#             return jsonify({"error": "Problem content not found on the page."}), 404

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
