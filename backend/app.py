
import google.generativeai as genai
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

# final_content = {'Codes': {'Python': '```Python\ndef quicksort(arr):\n    if len(arr) < 2:\n        return arr\n    else:\n        pivot = arr[0]\n        less = [i for i in arr[1:] if i <= pivot]\n        greater = [i for i in arr[1:] if i > pivot]\n        return quicksort(less) + [pivot] + quicksort(greater)\n\n```', 'C++': '```C++\n#include <iostream>\n#include <vector>\n\nint partition(std::vector<int>& arr, int low, int high) {\n    int pivot = arr[high];\n    int i = (low - 1);\n    for (int j = low; j <= high - 1; j++) {\n        if (arr[j] < pivot) {\n            i++;\n            std::swap(arr[i], arr[j]);\n        }\n    }\n    std::swap(arr[i + 1], arr[high]);\n    return (i + 1);\n}\n\nvoid quickSort(std::vector<int>& arr, int low, int high) {\n    if (low < high) {\n        int pi = partition(arr, low, high);\n        quickSort(arr, low, pi - 1);\n        quickSort(arr, pi + 1, high);\n    }\n}\n\nint main() {\n    std::vector<int> arr = {10, 7, 8, 9, 1, 5};\n    int n = arr.size();\n    quickSort(arr, 0, n - 1);\n    for (int i = 0; i < n; i++)\n        std::cout << arr[i] << " ";\n    std::cout << std::endl;\n    return 0;\n}\n```', 'Java': '```Java\nimport java.util.Arrays;\n\nclass QuickSort {\n\n    public static void quickSort(int[] arr, int low, int high) {\n        if (low < high) {\n            int pi = partition(arr, low, high);\n            quickSort(arr, low, pi - 1);\n            quickSort(arr, pi + 1, high);\n        }\n    }\n\n    static int partition(int[] arr, int low, int high) {\n        int pivot = arr[high];\n        int i = (low - 1);\n\n        for (int j = low; j <= high - 1; j++) {\n            if (arr[j] < pivot) {\n                i++;\n                swap(arr, i, j);\n            }\n        }\n        swap(arr, i + 1, high);\n        return (i + 1);\n    }\n\n    static void swap(int[] arr, int i, int j) {\n        int temp = arr[i];\n        arr[i] = arr[j];\n        arr[j] = temp;\n    }\n\n    public static void main(String[] args) {\n        int[] arr = {10, 7, 8, 9, 1, 5};\n        System.out.println("Unsorted array: " + Arrays.toString(arr));\n        quickSort(arr, 0, arr.length - 1);\n        System.out.println("Sorted array: " + Arrays.toString(arr));\n    }\n}\n```'}, 'Space_Complexity': 'O(log n) – due to the recursive calls.  In the worst case, it can be O(n).\n\n**Improvements and Alternatives:**\n\n* **Pivot Selection:**  Random pivot selection or median-of-three pivot selection can mitigate the worst-case scenario.\n* **In-place partitioning:** The provided code uses in-place partitioning, minimizing extra space usage.\n* **Alternatives:** Merge sort offers guaranteed O(n log n) performance but requires O(n) extra space.  Heapsort is another O(n log n) algorithm with O(1) extra space.  For smaller arrays, insertion sort might be more efficient due to its lower constant factors.', 'Improvements': "The provided Quicksort implementation can be improved in several ways:\n\n**1. Pivot Selection:**  Using the first element as the pivot is prone to worst-case performance with already sorted or reverse-sorted input.  Strategies like choosing a random pivot or the median-of-three (the median of the first, middle, and last elements) significantly reduce the likelihood of unbalanced partitions.\n\n**2. In-place Partitioning:** The current implementation creates new lists during partitioning, increasing space complexity.  An in-place partitioning algorithm modifies the original array directly, reducing space usage to O(log n) even in the average case and improving overall efficiency.  This involves using indices to track the partitioning boundaries within the original array rather than creating new lists.\n\n\n**3. Hybrid Approach:** For smaller subarrays (below a certain threshold), a simpler algorithm like insertion sort is often faster due to its lower overhead.  This hybrid approach combines the efficiency of Quicksort for larger arrays with the performance benefits of insertion sort for smaller ones.  A common threshold is around 10-15 elements.\n\n**4. Tail Recursion Optimization:**  While Python doesn't inherently optimize tail recursion,  a carefully structured implementation might allow for iterative processing instead of recursive calls, reducing the risk of stack overflow for very large inputs.  However, this often adds complexity and might not yield significant improvements in Python.", 'Time_Complexity': '* **Best Case:** O(n log n) – when the pivot consistently divides the array into roughly equal halves.\n* **Average Case:** O(n log n)\n* **Worst Case:** O(n²) – occurs when the pivot selection consistently results in highly unbalanced partitions (e.g., already sorted array and choosing the first or last element as pivot).', 'Logic': "The code implements the classic Quicksort algorithm using a recursive divide-and-conquer strategy.\n\n1. **Base Case:** If the input array `arr` has fewer than two elements, it's already sorted and returned.\n\n2. **Pivot Selection:** The first element of the array (`arr[0]`) is chosen as the pivot.  (Note:  This is a simple but potentially inefficient choice;  better pivot selection strategies exist.)\n\n3. **Partitioning:** The remaining elements are partitioned into two sub-arrays: `less` containing elements less than or equal to the pivot, and `greater` containing elements greater than the pivot.  List comprehensions efficiently achieve this partitioning.\n\n4. **Recursive Calls:** The `quicksort` function recursively sorts the `less` and `greater` sub-arrays.\n\n5. **Concatenation:** The sorted `less` array, the pivot, and the sorted `greater` array are concatenated to produce the fully sorted array, which is then returned.  This step combines the results of the recursive calls.\n\nThe algorithm's core logic lies in repeatedly partitioning the array around a pivot, recursively sorting the resulting sub-arrays, and then combining them.  The efficiency depends heavily on the choice of pivot and the resulting balance of the partitions."}

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins

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

    current_section = None
    is_code_section = False

    for line in response.text.split('\n'):
        line_stripped = line.strip()

        if line_stripped in section_markers:
            section_name = section_markers[line_stripped]

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
genai.configure(api_key='AIzaSyBoa52-OM0bZczkf8-4e2YQytu2zB9DUqs')

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
model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config,
)

chat_sessions = {}
@app.route('/answer', methods=['GET','POST'])
def solve():
    try:
        print("hi")
        base_problem_statement = (
            '''
            Generate code for this problem in {language}, and include the following in your response:
            Explanation of the logic, Time complexity and space complexity, any improvements or alternatives.
            Respond in a concise, article-style manner without conversational phrases or further invitations for discussion.
            '''
        )
        user_input = request.json.get("problemStatement", "")
        print(user_input," -> ps")
        if not user_input:
            return jsonify({"error": "Problem statement is required."}), 400

        base_problem_statement = user_input + base_problem_statement

        structured_output = {}
    
        for language in languages:
            problem_statement = base_problem_statement.format(language=language)
            chat_session = model.start_chat(history=[])
            response = chat_session.send_message(problem_statement)
            chat_sessions[language] = chat_session
            output = main_extractor(language, response)
            structured_output[language] = output
            print("here")

        final_content = final_parser(chat_sessions, structured_output)
        # print(final_content)
        return (final_content), 200

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
        answer = chat_sessions[refreshLang].send_message(f"Can u generate the {section} section again in a more accurate way")
        print("refreshed content:",answer.text)
        return jsonify({"content":answer.text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/code', methods=['GET','POST'])
def answerCode():
    try:
        code = request.json.get("code", "")
        # language = request.json.get("language", "")
        if not code:
            return jsonify({"error": f"error"}), 400
        # print(follow_up_question,language)
        # answer = chat_sessions[language].send_message(follow_up_question)
        chat_session = model.start_chat(history=[])
        code_query = "Analayze the code and explain in detail"
        code_query += code
        response = chat_session.send_message(code_query)
        print("doubt answer:",response.text)
        # answer = "**Base Case:** If the input array `arr` has fewer than two elements, it's already sorted and returned.\n\n2. **Pivot Selection:** The first element of the array (`arr[0]`) is chosen as the pivot.  (Note:  This is a simple but potentially inefficient choice;  better pivot selection strategies exist.)\n\n3. **Partitioning:** The remaining elements are partitioned into two sub-arrays: `less` containing elements less than or equal to the pivot, and `greater` containing elements greater than the pivot.  List comprehensions efficiently achieve this partitioning.\n\n"
        return jsonify({"answer":response.text}), 200
        # return jsonify({"answer":answer}), 200
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
                           Don't use phrases like "The provided *" noone is manually provide the code snippet to you
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
