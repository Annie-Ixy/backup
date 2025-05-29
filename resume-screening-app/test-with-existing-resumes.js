const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testWithExistingResumes() {
  const resumesPath = path.join(__dirname, '..', 'resumes.zip');
  
  if (!fs.existsSync(resumesPath)) {
    console.error('resumes.zip file not found at:', resumesPath);
    return;
  }

  console.log('Found resumes.zip file, testing upload...');
  
  try {
    // Create form data
    const form = new FormData();
    form.append('zipFile', fs.createReadStream(resumesPath));

    // Upload to server
    const response = await axios.post('http://localhost:5000/api/upload', form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    console.log('Upload successful:', response.data);
    
    const jobId = response.data.jobId;
    console.log('Job ID:', jobId);
    
    // Poll for results
    let completed = false;
    while (!completed) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const resultResponse = await axios.get(`http://localhost:9001/api/results/${jobId}`);
      const data = resultResponse.data;
      
      console.log(`Status: ${data.status}, Progress: ${data.progress || 0}%, Candidates: ${data.candidates?.length || 0}`);
      
      if (data.status === 'completed') {
        completed = true;
        console.log('\n=== ANALYSIS COMPLETE ===');
        console.log(`Total candidates processed: ${data.candidates.length}`);
        
        // Show top 5 candidates
        console.log('\nTop 5 Candidates:');
        data.candidates.slice(0, 5).forEach((candidate, index) => {
          console.log(`${index + 1}. ${candidate.name} - Score: ${candidate.score} - ${candidate.tier}`);
        });
      } else if (data.status === 'error') {
        console.error('Processing failed:', data.error);
        completed = true;
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  console.log('Testing resume screening system with existing resumes.zip...');
  console.log('Make sure the server is running on http://localhost:5000');
  testWithExistingResumes();
}

module.exports = testWithExistingResumes; 