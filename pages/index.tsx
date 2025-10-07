import { useState, useMemo } from 'react';

// Helper function to generate a simple unique ID
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

// New interface for a single generated sentence, now with a unique ID
interface GeneratedSentence {
  id: string; // Unique identifier for stable list rendering
  text: string;
}

interface SentenceEntry {
  original: string;
  generated: GeneratedSentence[]; // Array of objects
}

export default function Home() {
  const [originalInput, setOriginalInput] = useState('');
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('Enter text to test the trained model.');
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [messageBox, setMessageBox] = useState({
    isVisible: false,
    title: '',
    content: '',
  });

  const updateStatus = (message: string, error: boolean = false) => {
    setStatusMsg(message);
    setIsError(error);
  };

  const totalGeneratedCount = useMemo(() => {
    return sentences.reduce((acc, entry) => acc + entry.generated.length, 0);
  }, [sentences]);

  // Updated to create unique IDs for each generated sentence
  const addSentence = (original: string, generated: string[]) => {
    const generatedWithIds: GeneratedSentence[] = generated.map(text => ({
      id: generateUniqueId(),
      text,
    }));
    setSentences(prev => [...prev, { original, generated: generatedWithIds }]);
  };

  // Updated to access/modify the 'text' property
  const editGeneratedSentence = (sentenceIndex: number, generatedIndex: number) => {
    const currentText = sentences[sentenceIndex].generated[generatedIndex].text;
    const newText = prompt('Edit the sentence:', currentText);

    if (newText !== null && newText.trim() !== '') {
      setSentences(prev => {
        const newSentences = [...prev];
        // Create a new object to maintain immutability and update the text
        newSentences[sentenceIndex].generated[generatedIndex] = {
          ...newSentences[sentenceIndex].generated[generatedIndex],
          text: newText.trim(),
        };
        return newSentences;
      });
      updateStatus('Sentence edited successfully!');
    }
  };

  const removeGeneratedSentence = (sentenceIndex: number, generatedIdToRemove: string) => {
    setSentences(prevSentences => {
      // 1. Create a deep copy of the array of sentence entries
      const newSentences = [...prevSentences];
      
      // 2. Locate the specific entry that contains the sentence to be removed
      const targetEntry = newSentences[sentenceIndex];
      
      if (!targetEntry) {
        // Should not happen if sentenceIndex is valid, but good for safety
        updateStatus('Error: Could not find sentence entry.', true);
        return prevSentences;
      }
      
      // 3. Filter out the sentence using its unique ID (immutable removal)
      const newGenerated = targetEntry.generated.filter(
        (sentence) => sentence.id !== generatedIdToRemove
      );

      // 4. Update the entry with the new filtered array
      newSentences[sentenceIndex] = {
        ...targetEntry,
        generated: newGenerated,
      };

      // 5. Check if the original entry is now empty and remove the entry if so (immutable removal)
      if (newGenerated.length === 0) {
        newSentences.splice(sentenceIndex, 1); // Splice is acceptable here for array of objects removal
        updateStatus('Entire entry removed.');
      } else {
        updateStatus('Sentence removed.');
      }

      return newSentences;
    });
  };

  const removeEntry = (index: number) => {
    setSentences(prev => {
      const newSentences = [...prev];
      newSentences.splice(index, 1);
      return newSentences;
    });
    updateStatus('Entire entry removed.');
  };

  const handleGenerate = async () => {
    const originalText = originalInput.trim();
    if (!originalText) {
      updateStatus('Please enter a sentence first.', true);
      return;
    }

    setIsGenerating(true);
    updateStatus('Generating sentences using Gemini 2.5 Flash-Lite...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: originalText }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      // Ensure data.generatedSentences is treated as string[] for addSentence
      const generatedSentences: string[] = data.generatedSentences || [];

      if (Array.isArray(generatedSentences) && generatedSentences.length > 0) {
        addSentence(originalText, generatedSentences);
        setOriginalInput('');
        updateStatus(`Successfully generated ${generatedSentences.length} sentences!`);
      } else {
        updateStatus('Generation completed, but no valid sentences were returned.', true);
      }
    } catch (error) {
      console.error('Generation Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during generation.';
      updateStatus(`Error: ${errorMessage}`, true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTrain = async () => {
    if (totalGeneratedCount < 1) {
      updateStatus('You need at least 1 generated sentence to train the model.', true);
      return;
    }

    // Map back to just strings for the API call
    const sentencesToTrain = sentences.flatMap(s => s.generated.map(g => g.text));
    const sentencesString = JSON.stringify(sentencesToTrain, null, 2);

    setMessageBox({
      isVisible: false,
      title: 'Training Sentences Sent to Server',
      content: sentencesString,
    });

    setIsTraining(true);
    updateStatus('Training model in progress. This may take a moment...');

    try {
      const res = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: sentencesToTrain }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("error while training ")
        throw new Error(errorData.message || `Server responded with status ${res.status}`);
      }

      setIsModelTrained(true);
      updateStatus('Model training completed successfully! You can now test it below.');
    } catch (error) {
      console.error('Training Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during training.';
      updateStatus(`Error: ${errorMessage}`, true);
      setIsModelTrained(false);
    } finally {
      setIsTraining(false);
    }
  };

  const handleMatch = async () => {
    const testText = testInput.trim();
    if (!testText) {
      setTestResult('Please enter text to test the model.');
      return;
    }

    if (!isModelTrained) {
      setTestResult('The model has not been trained yet. Please train the model first.');
      return;
    }

    updateStatus('Testing against trained data...');

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: testText }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      console.log(data);
      const score = typeof data.bestScore === 'number' && isFinite(data.bestScore)
        ? (data.bestScore * 100).toFixed(2)
        : 'N/A';
      const matchText = data.bestMatch || 'No match found';

      let message = '';
      if (typeof data.bestScore === 'number' && isFinite(data.bestScore)) {
        if (data.bestScore >= 0.85) {
          message = `This text is highly similar to the trained data. Best match: "${matchText}".`;
        } else if (data.bestScore >= 0.5) {
          message = `Match found, but correlation is weak. Best match: "${matchText}".`;
        } else {
          message = `No strong correlation found with the trained data. Best match: "${matchText}".`;
        }
      } else {
        message = `No correlation score available. Best match: "${matchText}".`;
      }

      setTestResult(`Model prediction for "${testText}": ${message} (Correlation Score: ${score}%)`);
    } catch (error) {
      console.error('Test Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during testing.';
      setTestResult(`Error during testing: ${errorMessage}`);
    } finally {
      updateStatus('');
    }
  };

  const trainButtonDisabled = totalGeneratedCount < 1 || isTraining;

  return (
    <div className="bg-gray-50 flex items-center justify-center min-h-screen p-4 sm:p-8 font-sans antialiased">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-4xl">
        <header className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            NLP Sentence Generator
          </h1>
        </header>

        {/* --- Generate Section --- */}
        <section className="mb-6">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <textarea
              id="sentence-input"
              rows={3}
              className="flex-grow p-4 border border-gray-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-400"
              placeholder="Write your sentence here..."
              value={originalInput}
              onChange={e => setOriginalInput(e.target.value)}
              disabled={isGenerating}
            />
            <button
              id="generate-btn"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Sentences'}
            </button>
          </div>
          {statusMsg && (
            <p
              id="status-msg"
              className={`mt-4 text-center italic font-semibold ${
                isError ? 'text-red-500' : 'text-gray-600'
              }`}
            >
              {statusMsg}
            </p>
          )}
        </section>

        {/* --- Collected Sentences Section --- */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
            Collected Sentences (<span id="sentence-count">{totalGeneratedCount}</span> total, {sentences.length} entries)
          </h2>
          <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 shadow-inner">
            <ul id="sentence-list" className="space-y-4">
              {sentences.map((sentenceObj, index) => (
                <li
                  key={index}
                  className="bg-gray-100 p-4 rounded-lg shadow-md mb-4 border-l-4 border-blue-500"
                >
                  <p className="font-bold text-gray-800">
                    Original: &quot;{sentenceObj.original}&quot;
                  </p>

                  <ul className="list-none mt-2 text-gray-700 space-y-2">
                    {sentenceObj.generated.map((genObj) => (
                      <li
                        key={genObj.id} 
                        className="flex items-center justify-between p-2 rounded-lg bg-white shadow-sm"
                      >
                        <span className="flex-grow mr-4">
                          {genObj.text} 
                        </span>
                        <div className="flex space-x-2">
                          <button
                            className="bg-blue-500 text-white px-3 py-1 text-sm rounded-md hover:bg-blue-600 transition-colors shadow"
                            onClick={() =>
                              // We no longer need genIndex here, but let's keep the signature intact for edit
                              editGeneratedSentence(index, sentenceObj.generated.findIndex(s => s.id === genObj.id)) 
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="bg-red-500 text-white px-3 py-1 text-sm rounded-md hover:bg-red-600 transition-colors shadow"
                            onClick={() =>
                              // Pass the unique ID to the removal function
                              removeGeneratedSentence(index, genObj.id)
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <button
                    className="bg-gray-400 text-gray-800 px-4 py-2 mt-4 rounded-lg hover:bg-gray-500 transition-colors shadow-md"
                    onClick={() => removeEntry(index)}
                  >
                    Remove All
                  </button>
                </li>
              ))}
              {sentences.length === 0 && (
                <p className="text-center text-gray-400 italic pt-8">
                  No sentences collected yet. Generate a sentence to start.
                </p>
              )}
            </ul>
          </div>

          <div className="mt-6 text-center">
            {!isModelTrained && (
              <button
                id="train-btn"
                className={`px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg ${
                  trainButtonDisabled
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
                disabled={trainButtonDisabled}
                onClick={handleTrain}
              >
                {isTraining ? 'Training...' : `Train Model (${totalGeneratedCount} Sentences)`}
              </button>
            )}
          </div>
        </section>

        {/* --- Test Section (Only visible after training) --- */}
        {isModelTrained && (
          <section
            id="model-test-section"
            className="mt-8 border-t border-gray-200 pt-6"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
              Test Trained Model
            </h2>
            <p className="text-gray-600 mb-4">
              The model has been &quot;trained&quot; on your collected data. Enter a new sentence below and click &quot;Match&quot; to see its &quot;prediction&quot; against the trained data.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <textarea
                id="test-input"
                rows={2}
                className="flex-grow p-4 border border-gray-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-green-500 resize-none placeholder-gray-400"
                placeholder="Enter a new sentence to test..."
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
              />
              <button
                id="match-btn"
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
                onClick={handleMatch}
              >
                Match
              </button>
            </div>
            <div
              id="test-output"
              className="bg-green-100 text-green-800 p-4 rounded-lg font-medium mt-4"
            >
              {testResult}
            </div>
          </section>
        )}
      </div>

      {/* --- Custom Message Box/Modal --- */}
      {messageBox.isVisible && (
        <div
          id="message-box"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 id="message-box-title" className="text-xl font-bold text-gray-800">
                {messageBox.title}
              </h3>
              <button
                id="close-message-box-btn"
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
                onClick={() => setMessageBox(prev => ({ ...prev, isVisible: false }))}
              >
                &times;
              </button>
            </div>
            <pre
              id="message-box-content"
              className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-80"
            >
              {messageBox.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
