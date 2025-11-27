import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, 
  Users, 
  FileText, 
  MessageSquare, 
  CheckSquare, 
  LayoutDashboard, 
  LogOut, 
  Upload, 
  Mic, 
  MicOff, 
  Send, 
  User, 
  Settings,
  Menu,
  X,
  Award,
  AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  Timestamp,
  updateDoc,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

/**
 * FIREBASE CONFIGURATION & INITIALIZATION
 * * In a real-world app, these keys would be in environment variables.
 * For this environment, we use the injected variables.
 */
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- GLOBAL UTILS & API ---

/**
 * GEMINI API UTILITY
 * Handles communication with the AI models for various agents.
 */
const callGemini = async (prompt, systemInstruction = "") => {
  const apiKey = ""; // Injected at runtime
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini API Error");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that request.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error connecting to AI services. Please try again.";
  }
};

// --- TYPES & INTERFACES ---

const ROLES = {
  ADMIN: 'HR Admin',
  CANDIDATE: 'Candidate',
  EMPLOYEE: 'Employee'
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.ADMIN] },
  { id: 'hr-chat', label: 'HR Assistant', icon: MessageSquare, roles: [ROLES.ADMIN, ROLES.EMPLOYEE] },
  { id: 'resume', label: 'Resume Screener', icon: FileText, roles: [ROLES.ADMIN] },
  { id: 'interview', label: 'AI Interview', icon: Users, roles: [ROLES.CANDIDATE] },
  { id: 'onboarding', label: 'Onboarding', icon: CheckSquare, roles: [ROLES.EMPLOYEE, ROLES.ADMIN] },
];

// --- COMPONENTS ---

// 1. AUTH SCREEN
const AuthScreen = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role) => {
    setLoading(true);
    // Simulating role-based login logic
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
      } else {
          await signInAnonymously(auth);
      }
      onLogin(role);
    } catch (err) {
      console.error(err);
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-600 p-4 rounded-full">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">SmartHR AI</h1>
        <p className="text-slate-500 mb-8">Select your role to access the workspace</p>
        
        <div className="space-y-4">
          {Object.values(ROLES).map((role) => (
            <button
              key={role}
              onClick={() => handleRoleSelect(role)}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 border-2 border-slate-100 rounded-xl hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
            >
              <span className="font-semibold text-slate-700 group-hover:text-indigo-700">{role}</span>
              <User className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
            </button>
          ))}
        </div>
        {loading && <p className="mt-4 text-sm text-indigo-600 animate-pulse">Authenticating...</p>}
      </div>
    </div>
  );
};

// 2. HR ASSISTANT AGENT
const HRAssistant = ({ user }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hello! I'm your HR Policy Assistant. Ask me about leaves, benefits, or company guidelines.` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    const systemPrompt = `You are an expert HR Assistant for a Tech Company. 
    Company Policy Context:
    - Leaves: 20 days PTO, 10 days Sick Leave.
    - Remote Work: Hybrid policy (3 days office, 2 days home).
    - Payroll: Processed on the 28th of every month.
    - Benefits: Health insurance (BlueCross), Gym reimbursement ($50/mo).
    Answer politely and concisely. If unknown, advise contacting HR Admin.`;

    const reply = await callGemini(userMsg, systemPrompt);
    
    setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-600" />
        <h2 className="font-semibold text-indigo-900">HR Policy Assistant</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-xl shadow-sm text-sm ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-400 italic">
              AI is typing...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about leaves, payroll, etc..."
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={handleSend}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// 3. RESUME SCREENING AGENT
const ResumeScreener = ({ user }) => {
  const [jobDesc, setJobDesc] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Fetch previous screenings
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'screenings'), 
      // In real app, filter by user/admin. Here we show global for demo.
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.log(err)); // Add error callback
    return () => unsubscribe();
  }, [user]);

  const handleScreening = async () => {
    if (!jobDesc || !resumeText) return;
    setLoading(true);
    setAnalysis(null);

    const prompt = `
      Act as an expert Technical Recruiter.
      Job Description: ${jobDesc}
      Candidate Resume Text: ${resumeText}
      
      Task:
      1. Analyze the match between the resume and JD.
      2. Provide a match score (0-100).
      3. List 3 key strengths.
      4. List 3 missing skills or gaps.
      5. Final hiring recommendation (Strong Hire, Hire, Weak Hire, Reject).
      
      Output strictly in JSON format:
      {
        "score": number,
        "strengths": ["string"],
        "gaps": ["string"],
        "recommendation": "string",
        "summary": "string"
      }
    `;

    try {
      const resultText = await callGemini(prompt, "Return only valid JSON.");
      const cleanJson = resultText.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);
      
      setAnalysis(result);

      // Save to Firestore
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'screenings'), {
        jobTitle: jobDesc.slice(0, 30) + "...",
        score: result.score,
        recommendation: result.recommendation,
        timestamp: Timestamp.now(),
        createdBy: user.uid
      });

    } catch (e) {
      console.error("Parsing failed", e);
      alert("AI Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            New Screening
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Description</label>
              <textarea 
                className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste Job Description here..."
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Resume (Text)</label>
              <textarea 
                className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste parsed resume text here..."
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
              />
            </div>
            <button 
              onClick={handleScreening}
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
              }`}
            >
              {loading ? 'Analyzing Candidate...' : 'Analyze Match'}
            </button>
          </div>
        </div>

        {/* Recent History */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">Recent Screenings</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-sm font-medium text-slate-700 truncate w-1/2">{item.jobTitle}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  item.score >= 80 ? 'bg-green-100 text-green-700' :
                  item.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {item.score}% Match
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 overflow-y-auto h-[calc(100vh-8rem)]">
        {!analysis ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Award className="w-16 h-16 mb-4 opacity-20" />
            <p>Analysis results will appear here</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Match Report</h2>
                <div className={`text-2xl font-black ${
                  analysis.score >= 80 ? 'text-green-600' : 'text-amber-500'
                }`}>{analysis.score}/100</div>
             </div>
             
             <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                <h4 className="font-semibold text-slate-700 mb-2">Recommendation</h4>
                <p className="text-slate-600">{analysis.recommendation}</p>
                <p className="text-sm text-slate-500 mt-2">{analysis.summary}</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                 <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2"><CheckSquare className="w-4 h-4"/> Strengths</h4>
                 <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                   {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                 </ul>
               </div>
               <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                 <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Missing Skills</h4>
                 <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                   {analysis.gaps.map((s, i) => <li key={i}>{s}</li>)}
                 </ul>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 4. AI INTERVIEW AGENT
const InterviewAgent = ({ user }) => {
  const [active, setActive] = useState(false);
  const [role, setRole] = useState('');
  const [conversation, setConversation] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const startInterview = async () => {
    if (!role) return;
    setActive(true);
    const initialMsg = `Welcome to the interview for the ${role} position. I am your AI interviewer. Let's start with a simple question: Tell me about yourself and why you applied for this role.`;
    setConversation([{ sender: 'ai', text: initialMsg }]);
  };

  const handleResponse = async () => {
    if (!currentInput.trim()) return;
    
    const userAns = currentInput;
    const newConv = [...conversation, { sender: 'candidate', text: userAns }];
    setConversation(newConv);
    setCurrentInput('');
    setIsListening(false);

    // AI Logic
    const prompt = `
      You are an AI Interviewer for a ${role} position.
      Conversation History: ${JSON.stringify(newConv)}
      
      Task:
      1. Analyze the candidate's last answer.
      2. If the interview is short (< 3 turns), ask a relevant follow-up or new technical/behavioral question.
      3. If the interview is long enough (3 turns), say "Thank you, that concludes the interview" and provide a feedback summary.
      
      Return ONLY the response text.
    `;
    
    const reply = await callGemini(prompt, "Be professional and concise.");
    
    const finalConv = [...newConv, { sender: 'ai', text: reply }];
    setConversation(finalConv);

    if (reply.includes("concludes")) {
      // Generate final score
      generateFeedback(finalConv);
    }
  };

  const generateFeedback = async (history) => {
    const prompt = `Based on this interview transcript: ${JSON.stringify(history)}, generate a JSON with "score" (0-100), "pros", "cons".`;
    const res = await callGemini(prompt, "JSON only.");
    try {
      const json = JSON.parse(res.replace(/```json|```/g, ''));
      setFeedback(json);
    } catch(e) { console.error(e); }
  };

  // Simple Speech Recognition Mock
  const toggleSpeech = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCurrentInput(prev => prev + " " + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center">
          <div className="bg-indigo-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">AI Interview Mode</h2>
          <p className="text-slate-500 mb-6">Practice technical and behavioral questions with our adaptive AI agent.</p>
          
          <input
            type="text"
            placeholder="Enter Job Role (e.g. Frontend Dev)"
            className="w-full p-3 border border-slate-300 rounded-lg mb-4 text-center focus:ring-2 focus:ring-indigo-500"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <button 
            onClick={startInterview}
            disabled={!role}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
        <h3 className="font-semibold">{role} Interview</h3>
        <button onClick={() => { setActive(false); setConversation([]); setFeedback(null); }} className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded">End Session</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {conversation.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === 'candidate' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-xl shadow-sm ${
              msg.sender === 'candidate' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
            }`}>
              <p className="text-sm font-semibold mb-1 opacity-75 capitalize">{msg.sender === 'ai' ? 'Interviewer' : 'You'}</p>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        {feedback && (
          <div className="mx-auto max-w-md bg-white p-6 rounded-xl border border-indigo-200 shadow-lg mt-8">
            <h3 className="text-xl font-bold text-center text-indigo-800 mb-4">Interview Results</h3>
            <div className="text-center text-4xl font-black text-slate-800 mb-4">{feedback.score}/100</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="text-green-600">Pros:</strong>
                <ul className="list-disc list-inside text-slate-600">{feedback.pros?.map((p,i)=><li key={i}>{p}</li>)}</ul>
              </div>
              <div>
                <strong className="text-red-600">Cons:</strong>
                <ul className="list-disc list-inside text-slate-600">{feedback.cons?.map((p,i)=><li key={i}>{p}</li>)}</ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {!feedback && (
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="flex gap-2">
            <button 
              onClick={toggleSpeech}
              className={`p-3 rounded-lg transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {isListening ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}
            </button>
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResponse()}
              placeholder="Type or speak your answer..."
              className="flex-1 px-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={handleResponse}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 5. ONBOARDING AGENT
const OnboardingBoard = ({ user }) => {
  // Using Firestore to persist checked items would be ideal.
  // Using local state for this demo with useEffect to simulate fetch.
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Upload ID Proof', completed: false, category: 'Documents' },
    { id: 2, title: 'Sign Offer Letter', completed: true, category: 'Documents' },
    { id: 3, title: 'Watch Culture Video', completed: false, category: 'Training' },
    { id: 4, title: 'Setup Company Email', completed: false, category: 'IT' },
    { id: 5, title: 'Join Slack Channels', completed: false, category: 'IT' },
  ]);

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const progress = Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Aboard, {user.displayName || 'Employee'}!</h2>
        <p className="text-slate-500">Complete these steps to finish your onboarding.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
          <span>Overall Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div 
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['Documents', 'Training', 'IT'].map(category => (
          <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-100 font-bold text-slate-700">
              {category}
            </div>
            <div className="p-4 space-y-3">
              {tasks.filter(t => t.category === category).map(task => (
                <div 
                  key={task.id} 
                  onClick={() => toggleTask(task.id)}
                  className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-lg transition-colors"
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                  }`}>
                    {task.completed && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 6. DASHBOARD (ADMIN VIEW)
const AdminDashboard = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">HR Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Candidates', val: '124', icon: Users, color: 'bg-blue-500' },
          { label: 'Open Positions', val: '8', icon: Briefcase, color: 'bg-purple-500' },
          { label: 'Interviews Today', val: '12', icon: MessageSquare, color: 'bg-orange-500' },
          { label: 'Onboarding Pending', val: '3', icon: AlertCircle, color: 'bg-red-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className={`${stat.color} p-4 rounded-lg text-white`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">{stat.label}</p>
              <h4 className="text-2xl font-bold text-slate-800">{stat.val}</h4>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Recent Applications</h3>
          <button className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="p-4">Candidate</th>
              <th className="p-4">Role</th>
              <th className="p-4">AI Score</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[
              { name: 'Alice Smith', role: 'Frontend Dev', score: 92, status: 'Interview' },
              { name: 'Bob Johnson', role: 'Product Manager', score: 78, status: 'Review' },
              { name: 'Charlie Brown', role: 'Data Scientist', score: 85, status: 'Offer' },
              { name: 'David Lee', role: 'Backend Dev', score: 45, status: 'Rejected' },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-800">{row.name}</td>
                <td className="p-4 text-slate-600">{row.role}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    row.score > 80 ? 'bg-green-100 text-green-700' : 
                    row.score < 50 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{row.score}%</span>
                </td>
                <td className="p-4 text-slate-600">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN LAYOUT & ROUTER ---

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        // In real app, fetch role from DB. Here we persist role in memory or default
        if (!role) setRole(ROLES.ADMIN); 
      } else {
        setUser(null);
        setRole(null);
      }
    });
    return () => unsubscribe();
  }, [role]);

  const handleLogin = (selectedRole) => {
    setRole(selectedRole);
    // Determine default tab based on role
    if (selectedRole === ROLES.CANDIDATE) setActiveTab('interview');
    else if (selectedRole === ROLES.EMPLOYEE) setActiveTab('hr-chat');
    else setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRole(null);
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // Filter Nav Items based on Role
  const allowedNav = NAV_ITEMS.filter(item => item.roles.includes(role));

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard />;
      case 'hr-chat': return <HRAssistant user={user} />;
      case 'resume': return <ResumeScreener user={user} />;
      case 'interview': return <InterviewAgent user={user} />;
      case 'onboarding': return <OnboardingBoard user={user} />;
      default: return <div className="p-6 text-slate-500">Select a module from the sidebar.</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">SmartHR AI</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {allowedNav.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="bg-slate-700 p-2 rounded-full">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{role}</p>
              <p className="text-xs text-slate-500 truncate">Online</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-500" />
            <span className="font-bold">SmartHR</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-800 text-slate-300 absolute top-16 left-0 w-full z-50 shadow-xl border-b border-slate-700">
            {allowedNav.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-6 py-4 border-b border-slate-700 hover:bg-slate-700"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-6 py-4 text-red-400 hover:bg-slate-700"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-slate-100 p-4 md:p-8">
           <div className="max-w-7xl mx-auto h-full">
             {renderContent()}
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;