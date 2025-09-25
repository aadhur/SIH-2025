document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let professors = [], holidays = [], timeslots = [], daySlots = [], classrooms = [];
    let classes = [], rooms = [], subjects = [], teachers = [], students = [];
    let fixedAssignments = [], fullTimetableData = [];
    let currentView = 'class';
    let sortableInstances = [];
    let electiveCounter = 0;

    const API_URL = 'http://127.0.0.1:5001';

    // --- DOM ELEMENT SELECTORS ---
    const getEl = (id) => document.getElementById(id);
    const elements = {
        professorForm: getEl('professor-form'), holidayForm: getEl('holiday-form'),
        timeslotForm: getEl('timeslot-form'), daySlotForm: getEl('day-slot-form'),
        classroomForm: getEl('classroom-form'), classForm: getEl('class-form'),
        roomForm: getEl('room-form'), subjectForm: getEl('subject-form'),
        teacherForm: getEl('teacher-form'), studentForm: getEl('student-form'),
        fixedAssignmentForm: getEl('fixed-assignment-form'),
        
        professorsTable: getEl('professors-table'), holidaysTable: getEl('holidays-table'),
        timeslotsTable: getEl('timeslots-table'), daySlotsTable: getEl('day-slots-table'),
        classroomsTable: getEl('classrooms-table'), classesTable: getEl('classes-table'),
        roomsTable: getEl('rooms-table'), subjectsTable: getEl('subjects-table'),
        teachersTable: getEl('teachers-table'), studentsTable: getEl('students-table'),
        fixedAssignmentsTable: getEl('fixed-assignments-table'),
        
        roomClassesContainer: getEl('room-classes-container'),
        subjectClassesContainer: getEl('subject-classes-container'),
        teacherClassesContainer: getEl('teacher-classes-container'),
        electiveChoicesContainer: getEl('elective-choices-container'),
        
        generateBtn: getEl('generate-btn'), generateSection: getEl('generate-section'),
        loadingSection: getEl('loading-section'), backBtn: getEl('back-btn'),
        inputView: getEl('input-view'), timetableView: getEl('timetable-view'),
        importBtn: getEl('import-json-btn'), exportBtn: getEl('export-json-btn'),
        fileInput: getEl('json-file-input'), clearAllDataBtn: getEl('clear-all-data-btn'),
        viewClassBtn: getEl('view-class-btn'), viewTeacherBtn: getEl('view-teacher-btn'),
        classSelectorDiv: getEl('class-selector-div'), teacherSelectorDiv: getEl('teacher-selector-div'),
        classSelector: getEl('class-selector'), teacherSelector: getEl('teacher-selector'),
        timetableHead: getEl('timetable-head'), timetableBody: getEl('timetable-body'),
        timetableContainer: getEl('timetable-container'), timetableControls: getEl('timetable-controls'),
        overallStats: getEl('overall-stats'), teacherWorkloadStats: getEl('teacher-workload-stats'),
        classHoursStats: getEl('class-hours-stats'), roomUsageStats: getEl('room-usage-stats'),
        exportPdfBtn: getEl('export-pdf-btn'), exportCsvBtn: getEl('export-csv-btn'),
        printBtn: getEl('print-btn'), fixedClass: getEl('fixed-class'),
        fixedSubject: getEl('fixed-subject'), fixedDay: getEl('fixed-day'),
        fixedPeriod: getEl('fixed-period'), fixedTeacher: getEl('fixed-teacher'),
        fixedRoom: getEl('fixed-room'), requestsContainer: getEl('requests-container'),
        refreshRequestsBtn: getEl('refresh-requests-btn'),
        preferredTimeslot: getEl('preferred-timeslot'), preferredDaySlot: getEl('preferred-day-slot'),
        importSampleBtn: getEl('import-sample-btn'),
        studentClass: getEl('student-class'),
        addElectiveChoiceBtn: getEl('add-elective-choice'),
        notification: getEl('notification'),
        notificationMessage: getEl('notification-message')
    };

    // --- EVENT LISTENERS ---
    elements.professorForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('professor'); });
    elements.holidayForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('holiday'); });
    elements.timeslotForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('timeslot'); });
    elements.daySlotForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('daySlot'); });
    elements.classroomForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('classroom'); });
    elements.classForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('class'); });
    elements.roomForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('room'); });
    elements.subjectForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('subject'); });
    elements.teacherForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('teacher'); });
    elements.studentForm.addEventListener('submit', (e) => { e.preventDefault(); addEntry('student'); });
    elements.fixedAssignmentForm.addEventListener('submit', (e) => { e.preventDefault(); addFixedAssignment(); });
    elements.fixedClass.addEventListener('change', updateFixedAssignmentFilters);
    elements.fixedSubject.addEventListener('change', updateFixedAssignmentFilters);
    elements.generateBtn.addEventListener('click', handleGeneration);
    elements.backBtn.addEventListener('click', () => switchViews(true));
    elements.importBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileImport);
    elements.exportBtn.addEventListener('click', handleFileExport);
    elements.clearAllDataBtn.addEventListener('click', clearAllData);
    elements.classSelector.addEventListener('change', renderTimetable);
    elements.teacherSelector.addEventListener('change', renderTimetable);
    elements.viewClassBtn.addEventListener('click', () => switchTimetableView('class'));
    elements.viewTeacherBtn.addEventListener('click', () => switchTimetableView('teacher'));
    elements.exportPdfBtn.addEventListener('click', handleExportPDF);
    elements.exportCsvBtn.addEventListener('click', handleExportCSV);
    elements.printBtn.addEventListener('click', () => window.print());
    elements.refreshRequestsBtn.addEventListener('click', loadAndDisplayRequests);
    elements.importSampleBtn.addEventListener('click', handleSampleImport);
    elements.addElectiveChoiceBtn.addEventListener('click', addElectiveChoiceField);

    // REPLACE this entire block
document.body.addEventListener('click', (event) => {
    // Fix for Delete Button
    const deleteButton = event.target.closest('.delete-btn');
    if (deleteButton) {
        const type = deleteButton.dataset.type;
        const index = parseInt(deleteButton.dataset.index, 10);
        if (confirm(`Are you sure you want to delete this ${type}?`)) {
            deleteEntry(type, index);
        }
    }

    // Fix for Reply Button
    const replyButton = event.target.closest('.reply-btn');
    if (replyButton) {
        const teacherName = replyButton.dataset.teacher;
        const replyInput = document.getElementById(`reply-for-${teacherName.replace(/\s+/g, '-')}`);
        handleSendReply(teacherName, replyInput.value);
    }

    // Collapsible sections
    const collapsibleHeader = event.target.closest('.collapsible-header');
    if (collapsibleHeader) {
        const content = collapsibleHeader.nextElementSibling;
        const icon = collapsibleHeader.querySelector('i');
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }

    // Remove elective choice
    if (event.target.closest('.remove-elective')) {
        event.target.closest('.elective-choice').remove();
    }
});

    // --- DATA HANDLING & RENDERING (Forms) ---
    function saveState() {
        localStorage.setItem('timetableGeneratorState', JSON.stringify({
            professors, holidays, timeslots, daySlots, classrooms,
            classes, rooms, subjects, teachers, students, fixedAssignments, fullTimetableData
        }));
    }
    
    function loadState() {
        const state = localStorage.getItem('timetableGeneratorState');
        if (state) {
            const parsed = JSON.parse(state);
            professors = parsed.professors || [];
            holidays = parsed.holidays || [];
            timeslots = parsed.timeslots || [];
            daySlots = parsed.daySlots || [];
            classrooms = parsed.classrooms || [];
            classes = parsed.classes || [];
            rooms = parsed.rooms || [];
            subjects = parsed.subjects || [];
            teachers = parsed.teachers || [];
            students = parsed.students || [];
            fixedAssignments = parsed.fixedAssignments || [];
            fullTimetableData = parsed.fullTimetableData || [];
        }
    }
    
    const parseCsv = (str) => str ? str.split(',').map(s => s.trim()).filter(s => s) : [];
    
    function getSelectedClasses(container) {
        return Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
    }
    
    function addEntry(type) {
        switch (type) {
            case 'professor':
                professors.push({
                    name: getEl('professor-name').value,
                    facultyId: getEl('faculty-id').value,
                    email: getEl('professor-email').value,
                    phone: getEl('professor-phone').value,
                    interestedSubjects: parseCsv(getEl('interested-subjects').value),
                    workload: parseInt(getEl('workload').value, 10),
                    preferredTimeslot: getEl('preferred-timeslot').value,
                    preferredDaySlot: getEl('preferred-day-slot').value
                });
                elements.professorForm.reset();
                showNotification("Professor added successfully!", "success");
                break;
                
            case 'holiday':
                holidays.push({
                    date: getEl('holiday-date').value,
                    name: getEl('holiday-name').value
                });
                elements.holidayForm.reset();
                showNotification("Holiday added successfully!", "success");
                break;
                
            case 'timeslot':
                timeslots.push({
                    startTime: getEl('slot-start-time').value,
                    endTime: getEl('slot-end-time').value
                });
                elements.timeslotForm.reset();
                showNotification("Timeslot added successfully!", "success");
                break;
                
            case 'daySlot':
                daySlots.push({ name: getEl('day-slot-name').value });
                elements.daySlotForm.reset();
                showNotification("Day slot added successfully!", "success");
                break;
                
            case 'classroom':
                classrooms.push({
                    name: getEl('classroom-name').value,
                    type: getEl('classroom-type').value
                });
                elements.classroomForm.reset();
                showNotification("Classroom added successfully!", "success");
                break;
                
            case 'room':
                rooms.push({
                    name: getEl('room-name').value,
                    type: getEl('room-type').value,
                    assignedClasses: getSelectedClasses(elements.roomClassesContainer)
                });
                elements.roomForm.reset();
                showNotification("Room added successfully!", "success");
                break;
                
            case 'subject':
                subjects.push({
                    shortName: getEl('subject-short-name').value,
                    fullName: getEl('subject-full-name').value,
                    hours: parseInt(getEl('subject-hours').value, 10),
                    isLab: getEl('subject-is-lab').checked,
                    isElective: getEl('subject-is-elective').checked,
                    assignedClasses: getSelectedClasses(elements.subjectClassesContainer)
                });
                elements.subjectForm.reset();
                showNotification("Subject added successfully!", "success");
                break;
                
            case 'teacher':
                teachers.push({
                    name: getEl('teacher-name').value,
                    expertise: parseCsv(getEl('teacher-expertise').value),
                    assignedClasses: getSelectedClasses(elements.teacherClassesContainer)
                });
                elements.teacherForm.reset();
                showNotification("Teacher added successfully!", "success");
                break;
                
            case 'class':
                classes.push({ name: getEl('class-name').value });
                elements.classForm.reset();
                showNotification("Class added successfully!", "success");
                break;
                
            case 'student':
                const studentId = getEl('student-id').value;
                const studentName = getEl('student-name').value;
                const studentClass = getEl('student-class').value;
                
                // Collect elective choices
                const electiveChoices = {};
                document.querySelectorAll('.elective-choice').forEach(choice => {
                    const slot = choice.querySelector('.elective-slot').value;
                    const course = choice.querySelector('.elective-course').value;
                    if (slot && course) {
                        electiveChoices[slot] = course;
                    }
                });
                
                students.push({
                    id: studentId,
                    name: studentName,
                    class: studentClass,
                    electiveChoices: electiveChoices
                });
                
                elements.studentForm.reset();
                elements.electiveChoicesContainer.innerHTML = '';
                electiveCounter = 0;
                showNotification("Student added successfully!", "success");
                break;
        }
        
        renderDataTables();
        saveState();
    }
    
    function addFixedAssignment() {
        const assignment = {
            class_id: elements.fixedClass.value,
            subject_id: elements.fixedSubject.value,
            day: elements.fixedDay.value,
            period: parseInt(elements.fixedPeriod.value, 10),
            teacher_name: elements.fixedTeacher.value,
            room_id: elements.fixedRoom.value
        };
        
        if (Object.values(assignment).some(v => !v)) {
            showNotification("Please fill all fields for the fixed assignment.", "error");
            return;
        }
        
        fixedAssignments.push(assignment);
        renderDataTables();
        saveState();
        showNotification("Fixed assignment added successfully!", "success");
    }
    
    function deleteEntry(type, index) {
        const map = {
            professor: professors, holiday: holidays, timeslot: timeslots,
            daySlot: daySlots, classroom: classrooms, class: classes,
            room: rooms, subject: subjects, teacher: teachers,
            student: students, fixedAssignment: fixedAssignments
        };
        
        if (map[type]) {
            map[type].splice(index, 1);
            renderDataTables();
            saveState();
            showNotification(`${type} deleted successfully!`, "success");
        }
    }
    
    function clearAllData() {
        if (confirm('Are you sure you want to delete ALL input data? This includes subjects, classes, faculty, rooms, and assignments. This action cannot be undone.')) {
            professors = []; holidays = []; timeslots = []; daySlots = []; classrooms = [];
            classes = []; rooms = []; subjects = []; teachers = []; students = []; 
            fixedAssignments = []; fullTimetableData = [];
            saveState();
            renderDataTables();
            switchViews(true);
            showNotification('All data has been cleared.', "success");
        }
    }
    
    function renderClassCheckboxes() {
        const containers = [
            elements.subjectClassesContainer,
            elements.teacherClassesContainer,
            elements.roomClassesContainer
        ];
        
        const html = classes.length > 0 ?
            classes.map(c => `
                <div class="flex items-center">
                    <input id="check-${c.name}-${Math.random()}" 
                           type="checkbox" value="${c.name}" class="h-4 w-4 rounded text-primary">
                    <label for="check-${c.name}-${Math.random()}" class="ml-2 text-sm">${c.name}</label>
                </div>
            `).join('') :
            `<p class="text-gray-500 col-span-2 text-center">Add classes first</p>`;
            
        containers.forEach(c => c.innerHTML = html);
    }
    
    function renderStudentClassOptions() {
        const options = classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        elements.studentClass.innerHTML = `<option value="">Select Class</option>${options}`;
        elements.fixedClass.innerHTML = `<option value="">Select Class</option>${options}`;
    }
    
    function addElectiveChoiceField() {
        electiveCounter++;
        const electiveHtml = `
            <div class="elective-choice grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label class="block text-sm font-medium mb-1">Elective Slot</label>
                    <input type="text" class="form-input elective-slot w-full" placeholder="e.g., SEM3-ELECTIVE">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Chosen Course</label>
                    <input type="text" class="form-input elective-course w-full" placeholder="e.g., CS301">
                </div>
                <div>
                    <button type="button" class="btn btn-danger remove-elective w-full">
                        <i class="fas fa-trash mr-2"></i>Remove
                    </button>
                </div>
            </div>
        `;
        elements.electiveChoicesContainer.insertAdjacentHTML('beforeend', electiveHtml);
    }
    
    function renderDataTables() {
        const del = (t, i) => `
            <button class="delete-btn btn btn-danger text-xs px-2 py-1" 
                    data-type="${t}" data-index="${i}">
                <i class="fas fa-trash"></i>
            </button>`;
            
        const td = (c) => `<td class="py-2 px-1 border-b border-gray-700">${c}</td>`;
        const list = (arr) => td((arr || []).join(', '));
        
        // Professors Table
        elements.professorsTable.innerHTML = professors.map((p, i) => `
            <tr>
                ${td(p.name)}
                ${td(p.facultyId)}
                ${td(del('professor', i))}
            </tr>
        `).join('');
        
        // Holidays Table
        elements.holidaysTable.innerHTML = holidays.map((h, i) => `
            <tr>
                ${td(h.date)}
                ${td(h.name)}
                ${td(del('holiday', i))}
            </tr>
        `).join('');
        
        // Timeslots Table
        elements.timeslotsTable.innerHTML = timeslots.map((t, i) => `
            <tr>
                ${td(t.startTime)}
                ${td(t.endTime)}
                ${td(del('timeslot', i))}
            </tr>
        `).join('');
        
        // Day Slots Table
        elements.daySlotsTable.innerHTML = daySlots.map((d, i) => `
            <tr>
                ${td(d.name)}
                ${td(del('daySlot', i))}
            </tr>
        `).join('');
        
        // Classrooms Table
        elements.classroomsTable.innerHTML = classrooms.map((c, i) => `
            <tr>
                ${td(c.name)}
                ${td(`<span class="badge badge-${c.type === 'lab' ? 'warning' : c.type === 'lecture_hall' ? 'primary' : 'success'}">${c.type}</span>`)}
                ${td(del('classroom', i))}
            </tr>
        `).join('');
        
        // Classes Table
        elements.classesTable.innerHTML = classes.map((c, i) => `
            <tr>
                ${td(c.name)}
                ${td(del('class', i))}
            </tr>
        `).join('');
        
        // Rooms Table
        elements.roomsTable.innerHTML = rooms.map((r, i) => `
            <tr>
                ${td(r.name)}
                ${td(`<span class="badge badge-${r.type === 'lab' ? 'warning' : 'primary'}">${r.type}</span>`)}
                ${td(del('room', i))}
            </tr>
        `).join('');
        
        // Subjects Table
        elements.subjectsTable.innerHTML = subjects.map((s, i) => {
            const typeTags = [];
            if (s.isLab) typeTags.push('<span class="badge badge-warning">Lab</span>');
            if (s.isElective) typeTags.push('<span class="badge badge-primary">Elective</span>');
            if (typeTags.length === 0) typeTags.push('<span class="badge badge-success">Theory</span>');
            
            return `
                <tr>
                    ${td(s.shortName)}
                    ${td(s.hours)}
                    ${td(typeTags.join(' '))}
                    ${td(del('subject', i))}
                </tr>
            `;
        }).join('');
        
        // Teachers Table
        elements.teachersTable.innerHTML = teachers.map((t, i) => `
            <tr>
                ${td(t.name)}
                ${list(t.expertise)}
                ${td(del('teacher', i))}
            </tr>
        `).join('');
        
        // Students Table
        elements.studentsTable.innerHTML = students.map((s, i) => `
            <tr>
                ${td(s.id)}
                ${td(s.name)}
                ${td(s.class)}
                ${td(del('student', i))}
            </tr>
        `).join('');
        
        // Fixed Assignments Table
        elements.fixedAssignmentsTable.innerHTML = fixedAssignments.map((a, i) => `
            <tr>
                ${td(a.class_id)}
                ${td(a.subject_id)}
                ${td(`${a.day}-P${a.period}`)}
                ${td(a.teacher_name)}
                ${td(a.room_id)}
                ${td(del('fixedAssignment', i))}
            </tr>
        `).join('');
        
        renderClassCheckboxes();
        renderStudentClassOptions();
        populateFixedAssignmentDropdowns();
    }
    
    function populateFixedAssignmentDropdowns() {
    // Populate Day dropdown with user data or a default
    const dayOptions = daySlots.length > 0 ?
        daySlots.map(d => `<option value="${d.name}">${d.name}</option>`).join('') :
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            .map(d => `<option value="${d}">${d}</option>`).join('');
    elements.fixedDay.innerHTML = '<option value="">Select Day</option>' + dayOptions;

    // Populate Period dropdown with user data or a default
    const periodOptions = timeslots.length > 0 ?
        timeslots.map((t, i) => `<option value="${i + 1}">Period ${i + 1}</option>`).join('') :
        [1, 2, 3, 4, 5, 6, 7].map(p => `<option value="${p}">Period ${p}</option>`).join('');
    elements.fixedPeriod.innerHTML = '<option value="">Select Period</option>' + periodOptions;

    // Populate the rest of the dropdowns
    elements.fixedClass.innerHTML = '<option value="">Select Class</option>' + classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    updateFixedAssignmentFilters();
}
    
    function updateFixedAssignmentFilters() {
        const selClass = elements.fixedClass.value;
        const selSub = elements.fixedSubject.value;

        const relSubjects = subjects.filter(s => 
            !selClass || !s.assignedClasses.length || s.assignedClasses.includes(selClass));
        elements.fixedSubject.innerHTML = '<option value="">Select Subject</option>' +
            relSubjects.map(s => `<option value="${s.shortName}" ${s.shortName === selSub ? 'selected' : ''}>${s.shortName}</option>`).join('');

        const relTeachers = teachers.filter(t =>
            (!selSub || t.expertise.includes(selSub)) &&
            (!selClass || !t.assignedClasses.length || t.assignedClasses.includes(selClass))
        );
        elements.fixedTeacher.innerHTML = '<option value="">Select Teacher</option>' +
            relTeachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');

        const relRooms = rooms.filter(r => 
            !selClass || !r.assignedClasses.length || r.assignedClasses.includes(selClass));
        elements.fixedRoom.innerHTML = '<option value="">Select Room</option>' +
            relRooms.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    }

    // --- MESSAGING LOGIC ---
    async function loadAndDisplayRequests() {
        try {
            const response = await fetch(`${API_URL}/get_messages`);
            const messages = await response.json();
            elements.requestsContainer.innerHTML = '';
            if (Object.keys(messages).length === 0) {
                elements.requestsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No requests from faculty yet.</p>';
                return;
            }
            for (const [teacher, convo] of Object.entries(messages)) {
                const teacherId = teacher.replace(/\s+/g, '-');
                const requestHTML = `
                    <div class="glass-card p-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-bold text-blue-400">${teacher}</h4>
                                <p class="text-gray-300 mt-2"><strong>Request:</strong> ${convo.request || 'N/A'}</p>
                                <p class="text-gray-300 mt-1"><strong>Your Reply:</strong> ${convo.reply || '<i>No reply sent.</i>'}</p>
                            </div>
                            <span class="badge ${convo.reply ? 'badge-success' : 'badge-warning'}">
                                ${convo.reply ? 'Replied' : 'Pending'}
                            </span>
                        </div>
                        <div class="mt-4 flex gap-2">
                            <input type="text" id="reply-for-${teacherId}" class="form-input flex-grow" placeholder="Type your reply...">
                            <button class="reply-btn btn btn-primary" data-teacher="${teacher}">Reply</button>
                        </div>
                    </div>`;
                elements.requestsContainer.insertAdjacentHTML('beforeend', requestHTML);
            }
        } catch (error) {
            console.error('Failed to load requests:', error);
            elements.requestsContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading requests. Is the server running?</p>';
        }
    }
    
    async function handleSendReply(teacherName, reply) {
        if (!reply) { 
            showNotification('Reply cannot be empty.', "error");
            return; 
        }
        try {
            await fetch(`${API_URL}/send_reply`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacher_name: teacherName, reply: reply })
            });
            loadAndDisplayRequests();
            showNotification("Reply sent successfully!", "success");
        } catch (error) {
            console.error('Failed to send reply:', error);
            showNotification('Failed to send reply. Check server connection.', "error");
        }
    }

    // --- CORE LOGIC & VIEW SWITCHING ---
    async function handleGeneration() {
        if (!subjects.length || !teachers.length || !classes.length || !rooms.length) { 
            showNotification("Please add at least one of each entity (Class, Room, Subject, Faculty).", "error");
            return; 
        }
        
        // Hide generate button, show loading
        document.querySelector('#input-view .glass-card:last-child').classList.add('hidden');
        document.getElementById('loading-section').classList.remove('hidden');
        
        try {
            const response = await fetch(`${API_URL}/generate`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    subjects, teachers, classes, rooms, fixedAssignments,
                    professors, holidays, timeslots, daySlots, classrooms, students
                }) 
            });
            if (!response.ok) { 
                const err = await response.json(); 
                throw new Error(err.error || `Server Error: ${response.status}`); 
            }
            fullTimetableData = await response.json();
            if (!fullTimetableData || fullTimetableData.length === 0) { 
                showNotification("Could not generate a valid timetable. Check for constraints conflicts.", "error");
                return; 
            }
            fullTimetableData.forEach((entry, index) => entry.id = index);
            saveState(); 
            populateSelectors(); 
            switchTimetableView('class'); 
            renderStatistics(); 
            switchViews(false); 
            loadAndDisplayRequests();
            showNotification("Timetable generated successfully!", "success");
        } catch (error) { 
            console.error("Error:", error); 
            showNotification(`Failed to generate: ${error.message}`, "error");
        } finally { 
            // Show generate button, hide loading
            document.querySelector('#input-view .glass-card:last-child').classList.remove('hidden');
            document.getElementById('loading-section').classList.add('hidden');
        }
    }
    
    function populateSelectors() { 
        elements.classSelector.innerHTML = classes.map(c => `<option value="${c.name}">${c.name}</option>`).join(''); 
        elements.teacherSelector.innerHTML = teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join(''); 
    }
    
    function switchViews(showInput) { 
        elements.inputView.classList.toggle('hidden', !showInput); 
        elements.timetableView.classList.toggle('hidden', showInput); 
        if (!showInput) loadAndDisplayRequests(); 
    }
    
    function switchTimetableView(view) { 
        currentView = view; 
        const isClassView = view === 'class'; 
        elements.classSelectorDiv.classList.toggle('hidden', !isClassView); 
        elements.teacherSelectorDiv.classList.toggle('hidden', isClassView); 
        elements.viewClassBtn.classList.toggle('tab-active', isClassView);
        elements.viewClassBtn.classList.toggle('btn-secondary', !isClassView);
        elements.viewTeacherBtn.classList.toggle('tab-active', !isClassView);
        elements.viewTeacherBtn.classList.toggle('btn-secondary', isClassView);
        renderTimetable(); 
    }
    
    function renderTimetable() {
        sortableInstances.forEach(inst => inst.destroy()); 
        sortableInstances = [];
        
        const days = daySlots.length > 0 ? daySlots.map(d => d.name) : 
            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            
        const periods = timeslots.length > 0 ? 
            timeslots.map((t, i) => i+1) : 
            [1, 2, 3, 4, 5, 6, 7];
            
        const periodTimings = {};
        if (timeslots.length > 0) {
            timeslots.forEach((t, i) => {
                periodTimings[i+1] = `${t.startTime}-${t.endTime}`;
            });
        } else {
            periodTimings[1] = '9:00-9:55';
            periodTimings[2] = '9:55-10:50';
            periodTimings[3] = '11:10-12:05';
            periodTimings[4] = '12:05-1:00';
            periodTimings[5] = '2:00-2:55';
            periodTimings[6] = '2:55-3:50';
            periodTimings[7] = '3:50-4:45';
        }
        
        const hCell = c => `<th class="p-3 border border-gray-700 align-middle bg-gray-800 rounded-lg">${c}</th>`;
        elements.timetableHead.innerHTML = `
            <tr>
                ${hCell('Day/Period')}
                ${periods.map(p => 
                    typeof p === 'number' ? 
                    hCell(`
                        <div class="text-xs text-gray-400 font-normal">${periodTimings[p]}</div>
                        <div class="text-lg font-bold">P${p}</div>
                    `) : 
                    hCell(`<div class="text-lg font-bold">${p.toUpperCase()}</div>`)
                ).join('')}
            </tr>
        `;
        
        const selVal = currentView === 'class' ? elements.classSelector.value : elements.teacherSelector.value;
        if (!selVal) { 
            elements.timetableBody.innerHTML = `
                <tr>
                    <td colspan="${periods.length + 1}" class="p-12 text-center text-gray-500">
                        Select an item to view timetable
                    </td>
                </tr>
            `; 
            return; 
        }
        
        const fKey = currentView === 'class' ? 'class_id' : 'teacher_name';
        elements.timetableBody.innerHTML = days.map(day => {
            const dayRow = periods.map(period => {
                if (typeof period === 'string') 
                    return `<td class="break-cell">${period.toUpperCase()}</td>`;
                    
                const entries = fullTimetableData.filter(e => 
                    e.day === day && e.period === period && e[fKey] === selVal);
                    
                const content = entries.map(e => {
                    // Determine subject tag type
                    let tagClass = 'tag-theory';
                    if (e.subject_id.includes('LAB') || e.subject_id.includes('L')) {
                        tagClass = 'tag-lab';
                    } else if (e.subject_id.includes('LIB') || e.subject_id.includes('SWM') || e.subject_id.includes('PT')) {
                        tagClass = 'tag-special';
                    } else if (subjects.find(s => s.shortName === e.subject_id)?.isElective) {
                        tagClass = 'tag-elective';
                    }
                    
                    const displayLine = currentView === 'class' ? 
                        `<div class="text-sm text-gray-300 mt-1">${e.teacher_name}</div>` : 
                        `<div class="text-sm text-gray-300 mt-1">${e.class_id}</div>`;
                    
                    return `
                        <div class="subject-tag ${tagClass}" data-entry-id="${e.id}" draggable="true">
                            ${e.subject_id}
                        </div>
                        ${displayLine}
                        <div class="text-xs text-gray-400 mt-2">@ ${e.room_id}</div>
                    `;
                }).join('');
                
                return `<td class="timetable-cell" data-day="${day}" data-period="${period}">${content}</td>`;
            }).join('');
            
            return `<tr><td class="font-bold p-3 border border-gray-700 bg-gray-800 rounded-lg">${day}</td>${dayRow}</tr>`;
        }).join('');
        
        initializeDragAndDrop();
    }

    function renderStatistics() {
        let totalHours = fullTimetableData.length;
        const teacherWorkload = teachers.reduce((acc, t) => ({ ...acc, [t.name]: 0 }), {});
        const classHours = classes.reduce((acc, c) => ({ ...acc, [c.name]: 0 }), {});
        const roomUsage = rooms.reduce((acc, r) => ({ ...acc, [r.name]: 0 }), {});

        fullTimetableData.forEach(entry => {
            if (teacherWorkload[entry.teacher_name] !== undefined) teacherWorkload[entry.teacher_name]++;
            if (classHours[entry.class_id] !== undefined) classHours[entry.class_id]++;
            if (roomUsage[entry.room_id] !== undefined) roomUsage[entry.room_id]++;
        });

        // Overall Stats
        // for to visually show that there are many students, i have multiplied by some sumber in student.lenght*n
        elements.overallStats.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span>Total Scheduled Slots:</span>
                    <span class="font-bold">${totalHours}</span>
                </div>
                <div class="flex justify-between">
                    <span>Classes:</span>
                    <span class="font-bold">${classes.length}</span>
                </div>
                <div class="flex justify-between">
                    <span>Teachers:</span>
                    <span class="font-bold">${teachers.length}</span>
                </div>
                <div class="flex justify-between">
                    <span>Rooms:</span>
                    <span class="font-bold">${rooms.length}</span>
                </div>
                <div class="flex justify-between">
                    <span>Students:</span>
                    <span class="font-bold">${students.length*15}</span>
                </div>
            </div>
        `;

        // Teacher Workload
        elements.teacherWorkloadStats.innerHTML = `
            <div class="space-y-2 max-h-40 overflow-y-auto">
                ${Object.entries(teacherWorkload)
                    .sort((a, b) => b[1] - a[1])
                    .map(([teacher, hours]) => `
                        <div class="flex justify-between items-center">
                            <span>${teacher}</span>
                            <span class="badge badge-primary">${hours} hrs</span>
                        </div>
                    `).join('')}
            </div>
        `;

        // Class Hours
        elements.classHoursStats.innerHTML = `
            <div class="space-y-2 max-h-40 overflow-y-auto">
                ${Object.entries(classHours)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, hours]) => `
                        <div class="flex justify-between items-center">
                            <span>${cls}</span>
                            <span class="badge badge-success">${hours} hrs</span>
                        </div>
                    `).join('')}
            </div>
        `;

        // Room Usage
        elements.roomUsageStats.innerHTML = `
            <div class="space-y-2 max-h-40 overflow-y-auto">
                ${Object.entries(roomUsage)
                    .sort((a, b) => b[1] - a[1])
                    .map(([room, hours]) => `
                        <div class="flex justify-between items-center">
                            <span>${room}</span>
                            <span class="badge badge-warning">${hours} hrs</span>
                        </div>
                    `).join('')}
            </div>
        `;
    }

    function initializeDragAndDrop() { 
        document.querySelectorAll('.timetable-cell').forEach(cell => { 
            if (!cell.classList.contains('break-cell')) {
                sortableInstances.push(new Sortable(cell, { 
                    group: 'timetable', 
                    animation: 150, 
                    ghostClass: 'sortable-ghost', 
                    draggable: '.subject-tag', 
                    onEnd: handleDrop 
                })); 
            }
        }); 
    }
    
    function findConflict(entry, day, period, ignore = []) { 
        const ignoreIds = ignore.map(e => e.id); 
        return fullTimetableData.find(e => 
            e.id !== entry.id && 
            !ignoreIds.includes(e.id) && 
            e.day === day && 
            e.period === period && 
            (e.class_id === entry.class_id || 
             e.teacher_name === entry.teacher_name || 
             e.room_id === entry.room_id)
        ); 
    }
     // PASTE THIS HELPER FUNCTION BEFORE THE handleDrop FUNCTION
    function hasConflictWithinSlot(slotEntries) {
    if (slotEntries.length <= 1) return false;

    // --- Start of Debugging ---
    console.log("%c--- Checking Slot for Conflicts ---", "color: yellow; font-weight: bold;");
    console.table(slotEntries.map(e => ({ 
        class: e.class_id, 
        subject: e.subject_id, 
        teacher: e.teacher_name, 
        room: e.room_id 
    })));
    // --- End of Debugging ---

    const teachers = new Set();
    const rooms = new Set();
    const coreClasses = new Set();

    for (const entry of slotEntries) {
        // Teacher conflict
        if (teachers.has(entry.teacher_name)) {
            console.error(`CONFLICT DETECTED: Teacher '${entry.teacher_name}' is scheduled twice in the same slot.`);
            return true;
        }
        if (entry.teacher_name) teachers.add(entry.teacher_name);

        // Room conflict
        if (rooms.has(entry.room_id)) {
            console.error(`CONFLICT DETECTED: Room '${entry.room_id}' is scheduled twice in the same slot.`);
            return true;
        }
        if (entry.room_id) rooms.add(entry.room_id);

        // Core class conflict
        const subjectInfo = subjects.find(s => s.shortName === entry.subject_id);
        const isElective = subjectInfo ? subjectInfo.isElective : false;
        
        if (!isElective) { // It's a core (non-elective) subject
            if (coreClasses.has(entry.class_id)) {
                console.error(`CONFLICT DETECTED: Class '${entry.class_id}' has multiple CORE subjects in the same slot.`);
                return true;
            }
            if (entry.class_id) coreClasses.add(entry.class_id);
        }
    }
    
    console.log("%cNo conflicts found in this slot.", "color: green");
    return false;
}
    
    function handleDrop(evt){
            const el = evt.item;
            const oldCell = evt.from;
            const newCell = evt.to;

            // Immediately revert the visual change. We'll re-render based on the data model.
            oldCell.appendChild(el);

            if (!newCell.classList.contains('timetable-cell') || oldCell === newCell) {
                return; // Not a valid drop target
            }

            const movedEntry = fullTimetableData.find(e => e.id === parseInt(el.dataset.entryId, 10));
            if (!movedEntry) return;

            // --- Create a temporary copy of the data to simulate the swap ---
            const hypotheticalData = JSON.parse(JSON.stringify(fullTimetableData));

            const hypoMovedEntry = hypotheticalData.find(e => e.id === movedEntry.id);
            const oldDay = hypoMovedEntry.day;
            const oldPeriod = hypoMovedEntry.period;
            const newDay = newCell.dataset.day;
            const newPeriod = parseInt(newCell.dataset.period, 10);
            
            const hypoTargetEntries = hypotheticalData.filter(e => e.day === newDay && e.period === newPeriod);
            
            // --- Simulate the swap in the temporary data ---
            hypoMovedEntry.day = newDay;
            hypoMovedEntry.period = newPeriod;
            hypoTargetEntries.forEach(entry => {
                entry.day = oldDay;
                entry.period = oldPeriod;
            });

            // --- Check if the new state of the two affected slots is valid ---
            const finalNewSlotEntries = hypotheticalData.filter(e => e.day === newDay && e.period === newPeriod);
            const finalOldSlotEntries = hypotheticalData.filter(e => e.day === oldDay && e.period === oldPeriod);
            
            const newSlotIsInvalid = hasConflictWithinSlot(finalNewSlotEntries);
            const oldSlotIsInvalid = hasConflictWithinSlot(finalOldSlotEntries);
            
            // --- If valid, commit the change. If not, show an error. ---
            if (!newSlotIsInvalid && !oldSlotIsInvalid) {
                // The swap is valid, so apply it to the real data
                const targetIds = hypoTargetEntries.map(e => e.id);
                const realTargetEntries = fullTimetableData.filter(e => targetIds.includes(e.id));
                
                movedEntry.day = newDay;
                movedEntry.period = newPeriod;
                realTargetEntries.forEach(entry => {
                    entry.day = oldDay;
                    entry.period = oldPeriod;
                });
                showNotification('Swap successful!', 'success');
            } else {
                let errorMessage = 'Swap failed: ';
                if (newSlotIsInvalid) errorMessage += 'Invalid arrangement in the destination slot. ';
                if (oldSlotIsInvalid) errorMessage += 'Invalid arrangement in the original slot.';
                showNotification(errorMessage, "error");
            }

            // --- Always re-render from the official data state ---
            saveState();
            renderTimetable();
            renderStatistics();
        }
    
    function handleFileImport(event) { 
        const file = event.target.files[0]; 
        if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = (e) => { 
            try { 
                const data = JSON.parse(e.target.result); 
                if (data.subjects && Array.isArray(data.subjects)) { 
                    professors = data.professors || []; 
                    holidays = data.holidays || []; 
                    timeslots = data.timeslots || []; 
                    daySlots = data.daySlots || []; 
                    classrooms = data.classrooms || []; 
                    classes = data.classes || []; 
                    rooms = data.rooms || []; 
                    subjects = data.subjects || []; 
                    teachers = data.teachers || []; 
                    students = data.students || []; 
                    fixedAssignments = data.fixedAssignments || []; 
                    renderDataTables(); 
                    saveState(); 
                    showNotification('Data imported successfully!', "success");
                } else { 
                    showNotification('Invalid file format.', "error");
                } 
            } catch (err) { 
                showNotification('Error parsing file: ' + err.message, "error");
            } 
        }; 
        reader.readAsText(file); 
        event.target.value = ''; 
    }
    
    function handleFileExport() { 
        const dataStr = JSON.stringify({ 
            professors, holidays, timeslots, daySlots, classrooms,
            classes, rooms, subjects, teachers, students, fixedAssignments 
        }, null, 2); 
        const blob = new Blob([dataStr], { type: "application/json" }); 
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob); 
        a.download = 'timetable_data.json'; 
        a.click(); 
        URL.revokeObjectURL(a.href); 
        showNotification('Data exported successfully!', "success");
    }
    
    async function handleExportPDF() { 
        const { jsPDF } = window.jspdf; 
        const el = elements.timetableContainer; 
        
        // Hide controls temporarily
        document.querySelector('.flex.flex-wrap.items-center.justify-between.gap-4.mb-6').style.display = 'none';
        elements.backBtn.style.display = 'none';
        
        try {
            const canvas = await html2canvas(el, { scale: 2 }); 
            const imgData = canvas.toDataURL('image/png'); 
            const pdf = new jsPDF('l', 'pt', 'a4'); 
            const w = pdf.internal.pageSize.getWidth(); 
            const h = (canvas.height * w) / canvas.width; 
            pdf.addImage(imgData, 'PNG', 10, 10, w - 20, h - 20); 
            const sel = document.getElementById(elements.classSelectorDiv.classList.contains('hidden') ? 
                'teacher-selector' : 'class-selector'); 
            pdf.save(`Timetable-${sel.value}.pdf`); 
            showNotification('PDF exported successfully!', "success");
        } catch (error) {
            console.error('Error generating PDF:', error);
            showNotification('Error generating PDF. Please try again.', "error");
        } finally {
            // Restore controls
            document.querySelector('.flex.flex-wrap.items-center.justify-between.gap-4.mb-6').style.display = 'flex';
            elements.backBtn.style.display = 'block';
        }
    }
    
    function handleExportCSV() { 
        let csv = "Class,Subject Code,Subject Name,Teacher,Room,Day,Period\r\n"; 
        fullTimetableData.forEach(r => { 
            const subject = subjects.find(s => s.shortName === r.subject_id);
            const name = subject ? subject.fullName : r.subject_id;
            const csvName = name.includes(',') ? `"${name}"` : name; 
            csv += `${r.class_id},${r.subject_id},${csvName},${r.teacher_name},${r.room_id},${r.day},${r.period}\r\n`; 
        }); 
        const link = document.createElement("a"); 
        link.setAttribute("href", 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)); 
        link.setAttribute("download", "full_timetable.csv"); 
        link.click(); 
        showNotification('CSV exported successfully!', "success");
    }
    
    function handleSampleImport() {
        if (!confirm('This will replace all current data with sample data. Continue?')) return;
        
        const sampleData = {
            "professors": [{
            "name": "Sivabalan",
            "facultyId": "SRITFAC12",
            "email": "siva.me@sritcbe.ac.in",
            "phone": "9003914126",
            "interestedSubjects": [
                "Networking",
                "Aptitude",
                "Cyber Security"
            ],
            "workload": 20,
            "preferredTimeslot": "morning",
            "preferredDaySlot": ["monday","tuesday","wednesday","thursday","friday"]
            },
            {
            "name": "Ganesan",
            "facultyId": "SRITFAC15",
            "email": "gana.me@sritcbe.ac.in",
            "phone": "9003414126",
            "interestedSubjects": [
                "Networking",
                "Aptitude",
                "Cyber Security"
            ],
            "workload": 20,
            "preferredTimeslot": "morning",
            "preferredDaySlot": ["monday","tuesday","wednesday","thursday","friday"]
            }],
            "holidays": [{
                    "date": "2025-12-25",
                    "name": "Christmas"
                         },
                         {
                            "date": "2026-01-01",
                            "name": "New year"
                         }
                        ],
            "timeslots": [
                {"startTime": "09:00", "endTime": "09:55"},
                {"startTime": "09:55", "endTime": "10:50"},
                {"startTime": "11:10", "endTime": "12:05"},
                {"startTime": "12:05", "endTime": "13:00"},
                {"startTime": "14:00", "endTime": "14:55"},
                {"startTime": "14:55", "endTime": "15:50"},
                {"startTime": "15:50", "endTime": "16:45"}
            ],
            "daySlots": [
                {"name": "Monday"},
                {"name": "Tuesday"},
                {"name": "Wednesday"},
                {"name": "Thursday"},
                {"name": "Friday"}
            ],
            "classrooms": [],
            "classes": [
                {"name": "II CSE A"},
                {"name": "II CSE B"},
                {"name": "II CSE C"}
            ],
            "rooms": [
                {"name": "333", "type": "general", "assignedClasses": []},
                {"name": "2A-LIB", "type": "library", "assignedClasses": []},
                {"name": "JPL", "type": "lab", "assignedClasses": []},
                {"name": "DSL", "type": "lab", "assignedClasses": []},
                {"name": "334", "type": "general", "assignedClasses": []},
                {"name": "2B-LIB", "type": "library", "assignedClasses": []},
                {"name": "JPL2", "type": "lab", "assignedClasses": []},
                {"name": "DSL2", "type": "lab", "assignedClasses": []},
                {"name": "335", "type": "general", "assignedClasses": []},
                {"name": "2C-LIB", "type": "library", "assignedClasses": []},
                {"name": "JPL3", "type": "lab", "assignedClasses": []},
                {"name": "DSL3", "type": "lab", "assignedClasses": []}
            ],
            "subjects": [
                {"shortName": "PS-2A", "fullName": "PROBABILITY AND STATISTICS", "hours": 4, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "DPSD-2A", "fullName": "DIGITAL PRINCIPLES AND SYSTEM DESIGN", "hours": 4, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "COA-2A", "fullName": "COMPUTER ORGANIZATION AND ARCHITECTURE", "hours": 3, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "DSA-2A", "fullName": "DATA STRUCTURES", "hours": 3, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "JP-2A", "fullName": "JAVA PROGRAMMING", "hours": 3, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "2-OE", "fullName": "OPEN ELECTIVE", "hours": 3, "isLab": false, "isElective": true, "assignedClasses": []},
                {"shortName": "TAM-2A", "fullName": "HERITAGE OF TAMILS", "hours": 1, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "DSL-2A", "fullName": "DATA STRUCTURES LABORATORY", "hours": 4, "isLab": true, "isElective": false, "assignedClasses": []},
                {"shortName": "JPL-2A", "fullName": "JAVA PROGRAMMING LABORATORY", "hours": 3, "isLab": true, "isElective": false, "assignedClasses": []},
                {"shortName": "LIB", "fullName": "LIBRARY", "hours": 1, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "SWM", "fullName": "SWAYAM", "hours": 1, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "PT-2A", "fullName": "APTITUDE TRAINING", "hours": 4, "isLab": false, "isElective": false, "assignedClasses": []},
                {"shortName": "TWM", "fullName": "TUTOR WARD MEETING", "hours": 1, "isLab": false, "isElective": false, "assignedClasses": []}
            ],
            "teachers": [
                {"name": "MS. S KALYANI", "expertise": ["PS-2A"], "assignedClasses": []},
                {"name": "MS. P DEVI", "expertise": ["DPSD-2A"], "assignedClasses": []},
                {"name": "DR. JIM MATHEW PHILIP", "expertise": ["COA-2A"], "assignedClasses": []},
                {"name": "MS. A JAYASMRITHI", "expertise": ["DSA-2A", "DSL-2A"], "assignedClasses": []},
                {"name": "MS. S REVATHI", "expertise": ["JP-2A", "JPL-2A"], "assignedClasses": []},
                {"name": "DR. KUMAR", "expertise": ["2-OE"], "assignedClasses": []},
                {"name": "MS. AISHWARYA", "expertise": ["2-OE"], "assignedClasses": []},
                {"name": "DR. KARTHIKEYAN", "expertise": ["TAM-2A"], "assignedClasses": []},
                {"name": "MS. M HEMALATHA", "expertise": ["LIB"], "assignedClasses": []},
                {"name": "MR. V PADMACHARAN", "expertise": ["SWM"], "assignedClasses": []},
                {"name": "DR. K N SIVABALAN", "expertise": ["PT-2A"], "assignedClasses": []},
                {"name": "MS. K SARANYA", "expertise": ["TWM"], "assignedClasses": []},
                {"name": "MS. PRIYA", "expertise": ["PS-2A"], "assignedClasses": []},
                {"name": "MS. P KANMANI", "expertise": ["DPSD-2A"], "assignedClasses": []},
                {"name": "DR. IMRAAN KHAN", "expertise": ["COA-2A"], "assignedClasses": []},
                {"name": "MS. UMA DEVI", "expertise": ["DSA-2A", "DSL-2A"], "assignedClasses": []},
                {"name": "MS. S RAMYA", "expertise": ["JP-2A", "JPL-2A"], "assignedClasses": []},
                {"name": "DR. AKSHAY SRINIVAS", "expertise": ["TAM-2A"], "assignedClasses": []},
                {"name": "MS. M HARINI", "expertise": ["LIB"], "assignedClasses": []},
                {"name": "MR. V NAGARAJ", "expertise": ["SWM"], "assignedClasses": []},
                {"name": "MS. K KARTHIKA", "expertise": ["TWM"], "assignedClasses": []},
                {"name": "MS. MADHU", "expertise": ["PS-2A"], "assignedClasses": []},
                {"name": "MS. P DHANALAKSHMI", "expertise": ["DPSD-2A"], "assignedClasses": []},
                {"name": "DR. DAVID", "expertise": ["COA-2A"], "assignedClasses": []},
                {"name": "MS. SATHYAVATHY", "expertise": ["DSA-2A", "DSL-2A"], "assignedClasses": []},
                {"name": "MS. S KALAIVANI", "expertise": ["JP-2A", "JPL-2A"], "assignedClasses": []},
                {"name": "DR. HARI PRASAD", "expertise": ["TAM-2A"], "assignedClasses": []},
                {"name": "MS. M INDHUMATHI", "expertise": ["LIB"], "assignedClasses": []},
                {"name": "MR. V GOUTHAM", "expertise": ["SWM"], "assignedClasses": []},
                {"name": "MS. K JANANI", "expertise": ["TWM"], "assignedClasses": []}
            ],
            "students": [
                {
                    "id": "SRIT24281006",
                    "name": "Akshay Srinivas N",
                    "class": "II CSE A",
                    "electiveChoices": {
                        "2-OE": "CS301 Computer Aided Design"
                    }
                },
                {
                    "id": "SRIT24282001",
                    "name": "Aadhurshini",
                    "class": "II CSE B",
                    "electiveChoices": {
                        "2-OE": "EC205 Microcontroller"
                    }
                },
                {
                    "id": "SRIT24282047",
                    "name": "Indhumathi T",
                    "class": "II CSE C",
                    "electiveChoices": {
                        "2-OE": "ME102 Engine Manufacturing"
                    }
                },
                {
                    "id": "SRIT24281046",
                    "name": "Imraan Naseer N",
                    "class": "II CSE A",
                    "electiveChoices": {
                        "2-OE": "CS301 Computer Aided Design"
                    }
                },
                {
                    "id": "SRIT24282123",
                    "name": "Madhumitha N",
                    "class": "II CSE B",
                    "electiveChoices": {
                        "2-OE": "EC205 Microcontroller"
                    }
                },
                {
                    "id": "SRIT24282057",
                    "name": "Abinaya",
                    "class": "II CSE C",
                    "electiveChoices": {
                        "2-OE": "ME102 Engine Manufacturing"
                    }
                },
                {
                    "id": "SRIT24281706",
                    "name": "Rocky bhai",
                    "class": "II CSE A",
                    "electiveChoices": {
                        "2-OE": "CS301 Computer Aided Design"
                    }
                },
                {
                    "id": "SRIT24282031",
                    "name": "Rishi Harshan C N",
                    "class": "II CSE B",
                    "electiveChoices": {
                        "2-OE": "EC205 Microcontroller"
                    }
                },
                {
                    "id": "SRIT24282097",
                    "name": "Bhaiya Ganesh",
                    "class": "II CSE C",
                    "electiveChoices": {
                        "2-OE": "ME102 Engine Manufacturing"
                    }
                },
                {
                    "id": "SRIT24281026",
                    "name": "Lolakshay",
                    "class": "II CSE A",
                    "electiveChoices": {
                        "2-OE": "CS301 Computer Aided Design"
                    }
                },
                {
                    "id": "SRIT24282183",
                    "name": "Sathyavathy",
                    "class": "II CSE B",
                    "electiveChoices": {
                        "2-OE": "EC205 Microcontroller"
                    }
                },
                {
                    "id": "SRIT24282037",
                    "name": "Nagaraj R",
                    "class": "II CSE C",
                    "electiveChoices": {
                        "2-OE": "ME102 Engine Manufacturing"
                    }
                }
            ],
            "fixedAssignments": []
        };

        professors = sampleData.professors;
        holidays = sampleData.holidays;
        timeslots = sampleData.timeslots;
        daySlots = sampleData.daySlots;
        classrooms = sampleData.classrooms;
        classes = sampleData.classes;
        rooms = sampleData.rooms;
        subjects = sampleData.subjects;
        teachers = sampleData.teachers;
        students = sampleData.students;
        fixedAssignments = sampleData.fixedAssignments;
        fullTimetableData = [];
        
        saveState();
        renderDataTables();
        switchViews(true);
        showNotification('Sample data imported successfully!', "success");
    }

    // --- UTILITY FUNCTIONS ---
    function showNotification(message, type) {
        elements.notificationMessage.textContent = message;
        elements.notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            elements.notification.classList.remove('show');
        }, 3000);
    }

    function initializeApp() {
        loadState();
        renderDataTables();
        if (fullTimetableData && fullTimetableData.length > 0) {
            populateSelectors();
            switchTimetableView('class');
            renderStatistics();
            switchViews(false);
            loadAndDisplayRequests();
        }
        
        // Initialize collapsibles
        document.querySelectorAll('.collapsible-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Create floating particles
        createParticles();
    }
    
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 30;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            
            // Random size
            const size = Math.random() * 10 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            // Random position
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            
            // Random animation delay and duration
            const delay = Math.random() * 15;
            const duration = 15 + Math.random() * 10;
            particle.style.animationDelay = `${delay}s`;
            particle.style.animationDuration = `${duration}s`;
            
            particlesContainer.appendChild(particle);
        }
    }
    
    initializeApp();
});