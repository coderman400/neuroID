import { useState } from 'react';
import { Shield, FileText, History, Fingerprint, Plus, ExternalLink, Clock, Check, X, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data
  const userData = {
    did: "did:skibidi:0x7f8e9d5a3b1c0e4f2d6a8b9c7e5f3d2a1b0c9e8d",
    name: "Alex Johnson",
    email: "alex@example.com",
    createdAt: "March 15, 2025"
  };
  
  const documents = [
    { id: 1, type: "Passport", verified: true, lastVerified: "April 5, 2025" },
    { id: 2, type: "Driver's License", verified: true, lastVerified: "April 1, 2025" },
    { id: 3, type: "National ID", verified: false, lastVerified: null }
  ];
  
  const accessLogs = [
    { id: 1, service: "TravelSecure", timestamp: "April 8, 2025 - 14:23", status: "approved", dataAccessed: ["Name", "Date of Birth", "Passport Number"] },
    { id: 2, service: "FinTech Solutions", timestamp: "April 7, 2025 - 09:45", status: "approved", dataAccessed: ["Name", "Address"] },
    { id: 3, service: "Unknown Service", timestamp: "April 5, 2025 - 22:12", status: "denied", dataAccessed: [] }
  ];
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Fingerprint className="h-8 w-8 text-indigo-400" />
            <span className="text-xl font-bold text-indigo-400">SKIBIDI ID</span>
          </div>
          <div className="flex items-center space-x-6">
            <button className="text-sm text-gray-300 hover:text-indigo-400">Features</button>
            <button className="text-sm text-gray-300 hover:text-indigo-400">How It Works</button>
            <button className="text-sm text-gray-300 hover:text-indigo-400">Security</button>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm">Disconnect Wallet</button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-indigo-400">Welcome to Your Digital Identity</h1>
          <p className="text-gray-400">Manage your decentralized identity, documents, and access control in one secure place.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6">
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'overview' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'documents' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'access' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('access')}
          >
            Access Logs
          </button>
        </div>
        
        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="col-span-1">
            {/* DID Section */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-indigo-400">Your Identity</h2>
                <Shield className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-1">Your DID</p>
                <div className="flex items-center">
                  <p className="text-sm font-mono bg-gray-900 p-2 rounded w-full truncate">{userData.did}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400">Identity Created</p>
                <p className="text-sm">{userData.createdAt}</p>
              </div>
            </div>
            
            {/* Stats Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-indigo-400">Security Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-xs text-gray-400">Identity Strength</p>
                  <p className="text-2xl font-bold text-green-400">Strong</p>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-xs text-gray-400">Verifications</p>
                  <p className="text-2xl font-bold text-indigo-400">{documents.filter(d => d.verified).length}</p>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-xs text-gray-400">Access Grants</p>
                  <p className="text-2xl font-bold text-indigo-400">{accessLogs.filter(log => log.status === 'approved').length}</p>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-xs text-gray-400">Access Denials</p>
                  <p className="text-2xl font-bold text-red-400">{accessLogs.filter(log => log.status === 'denied').length}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column (2/3 width) */}
          <div className="col-span-1 lg:col-span-2">
            {/* Documents Section */}
            {activeTab === 'overview' || activeTab === 'documents' ? (
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-indigo-400">Your Documents</h2>
                  <button className="flex items-center text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md">
                    <Plus className="h-4 w-4 mr-1" /> Add Document
                  </button>
                </div>
                
                {documents.length > 0 ? (
                  <div className="space-y-4">
                    {documents.map(doc => (
                      <div key={doc.id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-indigo-400 mr-2" />
                          <div>
                            <p className="font-medium">{doc.type}</p>
                            {doc.verified && (
                              <p className="text-xs text-gray-400">Verified on {doc.lastVerified}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {doc.verified ? (
                            <span className="inline-flex items-center bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded">
                              <Check className="h-3 w-3 mr-1" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center bg-yellow-900/30 text-yellow-400 text-xs px-2 py-1 rounded">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Pending
                            </span>
                          )}
                          <button className="text-gray-400 hover:text-indigo-400">
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>You have not added any documents yet</p>
                    <button className="mt-2 text-indigo-400 text-sm">Add your first document</button>
                  </div>
                )}
                
                {activeTab === 'overview' && (
                  <div className="mt-4 text-right">
                    <button className="text-indigo-400 text-sm hover:underline" onClick={() => setActiveTab('documents')}>
                      View all documents →
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Access Logs Section */}
            {activeTab === 'overview' || activeTab === 'access' ? (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-indigo-400">Third Party Access Logs</h2>
                  {activeTab === 'access' && (
                    <div className="flex items-center space-x-2">
                      <button className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md">
                        Filter
                      </button>
                      <button className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md">
                        Export
                      </button>
                    </div>
                  )}
                </div>
                
                {accessLogs.length > 0 ? (
                  <div className="space-y-4">
                    {accessLogs.map(log => (
                      <div key={log.id} className="bg-gray-900 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                          <div className="flex items-center">
                            <History className="h-5 w-5 text-indigo-400 mr-2" />
                            <span className="font-medium">{log.service}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400 flex items-center">
                              <Clock className="h-3 w-3 mr-1" /> {log.timestamp}
                            </span>
                            {log.status === 'approved' ? (
                              <span className="inline-flex items-center bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded">
                                <Check className="h-3 w-3 mr-1" /> Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center bg-red-900/30 text-red-400 text-xs px-2 py-1 rounded">
                                <X className="h-3 w-3 mr-1" /> Denied
                              </span>
                            )}
                          </div>
                        </div>
                        {log.status === 'approved' && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-400">Data accessed:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {log.dataAccessed.map((data, idx) => (
                                <span key={idx} className="text-xs bg-gray-700 px-2 py-1 rounded">
                                  {data}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No access logs to display</p>
                  </div>
                )}
                
                {activeTab === 'overview' && accessLogs.length > 0 && (
                  <div className="mt-4 text-right">
                    <button className="text-indigo-400 text-sm hover:underline" onClick={() => setActiveTab('access')}>
                      View all access logs →
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Alert for privacy */}
            {activeTab === 'overview' && (
              <Alert className="mt-6 bg-indigo-900/40 border-indigo-400 text-indigo-100">
                <AlertTitle className="text-indigo-300">Your data is secure</AlertTitle>
                <AlertDescription className="text-indigo-200">
                  All your personal information is encrypted and stored on-chain. Only you control who can access your identity details.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}