import { useState, useEffect } from "react";

export default function Departments() {
    const [departments, setDepartments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [deptToDelete, setDeptToDelete] = useState(null);
    const [nameInput, setNameInput] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDepartments(); }, []);

    const fetchDepartments = async () => {
        try {
            const response = await fetch("/api/departments");
            const data = await response.json();
            setDepartments(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = editingDept ? `/api/departments/${editingDept.id}` : "/api/departments";
        const method = editingDept ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: nameInput })
        });

        if (response.ok) {
            closeModal();
            fetchDepartments();
        }
    };

    const confirmDelete = async () => {
        if (!deptToDelete) return;
        const response = await fetch(`/api/departments/${deptToDelete.id}`, { method: "DELETE" });
        if (response.ok) {
            setIsDeleteModalOpen(false);
            setDeptToDelete(null);
            fetchDepartments();
        }
    };

    const openEditModal = (dept) => {
        setEditingDept(dept);
        setNameInput(dept.name);
        setIsModalOpen(true);
    };

    const openDeleteModal = (dept) => {
        setDeptToDelete(dept);
        setIsDeleteModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingDept(null);
        setNameInput("");
    };

    if (loading) return <div style={{ color: '#666', padding: '40px' }}>Syncing Ventures...</div>;

    return (
        <div style={{ padding: '40px', color: 'white', backgroundColor: 'black', minHeight: '100vh', fontFamily: 'sans-serif' }}>

            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <p style={{ color: '#444', fontSize: '10px', fontWeight: '800', letterSpacing: '3px', marginBottom: '10px' }}>VENTURES / DEPARTMENT MANAGEMENT</p>
                    <h1 style={{ fontSize: '42px', margin: 0, fontWeight: '800', letterSpacing: '-1px' }}>
                        Departments <span style={{ color: '#222', marginLeft: '15px' }}>{departments.length}</span>
                    </h1>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{ backgroundColor: 'white', color: 'black', padding: '12px 24px', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                >
                    + Add Department
                </button>
            </div>

            {/* Main Table */}
            <div style={{ border: '1px solid #1a1a1a', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#050505' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#0a0a0a', color: '#444', fontSize: '10px', fontWeight: 'bold' }}>
                    <tr>
                        <th style={{ padding: '24px', borderBottom: '1px solid #1a1a1a', letterSpacing: '2px' }}>ID</th>
                        <th style={{ padding: '24px', borderBottom: '1px solid #1a1a1a', letterSpacing: '2px' }}>NAME</th>
                        <th style={{ padding: '24px', borderBottom: '1px solid #1a1a1a', textAlign: 'right', letterSpacing: '2px' }}>ACTIONS</th>
                    </tr>
                    </thead>
                    <tbody>
                    {departments.map((dept) => (
                        <tr key={dept.id} style={{ borderBottom: '1px solid #111' }}>
                            <td style={{ padding: '24px', color: '#333', fontFamily: 'monospace', fontSize: '13px' }}>#{dept.id}</td>
                            <td style={{ padding: '24px', fontWeight: '600', fontSize: '16px' }}>{dept.name}</td>
                            <td style={{ padding: '24px', textAlign: 'right' }}>
                                <button onClick={() => openEditModal(dept)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginRight: '20px', fontWeight: 'bold', fontSize: '11px' }}>EDIT</button>
                                <button onClick={() => openDeleteModal(dept)} style={{ background: 'none', border: 'none', color: '#400', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>DELETE</button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* CREATE / EDIT MODAL */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 10px 0' }}>{editingDept ? "Update" : "Create"}</h2>
                        <p style={{ color: '#444', fontSize: '14px', marginBottom: '30px' }}>Enter the name for this organization branch.</p>
                        <form onSubmit={handleSubmit}>
                            <input
                                autoFocus
                                placeholder="Department Name"
                                style={{ width: '100%', padding: '16px', backgroundColor: '#000', border: '1px solid #222', borderRadius: '12px', color: 'white', marginBottom: '25px', fontSize: '16px', boxSizing: 'border-box' }}
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeModal} style={{ flex: 1, padding: '14px', background: 'none', border: '1px solid #222', color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '14px', backgroundColor: 'white', border: 'none', color: 'black', fontWeight: 'bold', borderRadius: '12px', cursor: 'pointer' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {isDeleteModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #400', padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ color: '#f00', fontSize: '40px', marginBottom: '20px' }}>⚠️</div>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 10px 0' }}>Delete Department?</h2>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '30px' }}>
                            You are about to remove <b>{deptToDelete?.name}</b>. This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '14px', background: 'none', border: '1px solid #222', color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Keep it</button>
                            <button onClick={confirmDelete} style={{ flex: 1, padding: '14px', backgroundColor: '#f00', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '12px', cursor: 'pointer' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}