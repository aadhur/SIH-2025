import json
import collections
import traceback
import random
import copy
import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from ortools.sat.python import cp_model

@app.route('/')
def index():
    return render_template('index.html')

# --- SETUP ---
app = Flask(__name__)
CORS(app)

# --- IN-MEMORY DATABASE FOR MESSAGES ---
MESSAGES = {}

# --- IN-MEMORY DATABASE FOR TIMETABLES ---
GENERATED_TIMETABLES = {}  # Store generated timetables by class/teacher


# --- MESSAGING ENDPOINTS ---
@app.route('/send_request', methods=['POST'])
def send_request():
    try:
        data = request.get_json()
        teacher_name = data.get('teacher_name')
        message = data.get('message')

        if not teacher_name or not message:
            return jsonify({"success": False, "error": "Teacher name and message are required."}), 400

        # Initialize teacher entry if not exists
        if teacher_name not in MESSAGES:
            MESSAGES[teacher_name] = {}

        MESSAGES[teacher_name]['request'] = message
        MESSAGES[teacher_name]['reply'] = ''  # Clear previous reply

        print(f"Received request from {teacher_name}: {message}")
        return jsonify({"success": True, "message": "Request sent successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@app.route('/send_reply', methods=['POST'])
def send_reply():
    try:
        data = request.get_json()
        teacher_name = data.get('teacher_name')
        reply = data.get('reply')

        if not teacher_name or not reply:
            return jsonify({"success": False, "error": "Teacher name and reply are required."}), 400

        # Initialize teacher entry if not exists
        if teacher_name not in MESSAGES:
            MESSAGES[teacher_name] = {}

        MESSAGES[teacher_name]['reply'] = reply
        print(f"Sent reply to {teacher_name}: {reply}")
        return jsonify({"success": True, "message": "Reply sent successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@app.route('/get_messages', methods=['GET'])
def get_messages():
    try:
        return jsonify(MESSAGES)
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route('/get_my_messages/<teacher_name>', methods=['GET'])
def get_my_messages(teacher_name):
    try:
        # Return the specific teacher's messages or empty dict
        teacher_messages = MESSAGES.get(teacher_name, {})
        return jsonify(teacher_messages)
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


# --- TIMETABLE FETCHING ENDPOINTS ---
@app.route('/get_class_timetable/<class_id>', methods=['GET'])
def get_class_timetable(class_id):
    """Get timetable for a specific class"""
    try:
        class_timetable = []
        for entry in GENERATED_TIMETABLES.get('entries', []):
            if entry.get('class_id') == class_id:
                class_timetable.append(entry)

        # Sort by day and period
        days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        class_timetable.sort(key=lambda x: (days_order.index(x['day']), x['period']))

        return jsonify(class_timetable)
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route('/get_teacher_timetable/<teacher_name>', methods=['GET'])
def get_teacher_timetable(teacher_name):
    """Get timetable for a specific teacher"""
    try:
        teacher_timetable = []
        for entry in GENERATED_TIMETABLES.get('entries', []):
            if entry.get('teacher_name') == teacher_name:
                teacher_timetable.append(entry)

        # Sort by day and period
        days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        teacher_timetable.sort(key=lambda x: (days_order.index(x['day']), x['period']))

        return jsonify(teacher_timetable)
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route('/get_room_timetable/<room_id>', methods=['GET'])
def get_room_timetable(room_id):
    """Get timetable for a specific room"""
    try:
        room_timetable = []
        for entry in GENERATED_TIMETABLES.get('entries', []):
            if entry.get('room_id') == room_id:
                room_timetable.append(entry)

        # Sort by day and period
        days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        room_timetable.sort(key=lambda x: (days_order.index(x['day']), x['period']))

        return jsonify(room_timetable)
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route('/get_all_timetables', methods=['GET'])
def get_all_timetables():
    """Get all generated timetables"""
    try:
        return jsonify(GENERATED_TIMETABLES)
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


# --- GENETIC ALGORITHM IMPLEMENTATION ---
class TimetableGA:
    def __init__(self, subjects, teachers, classes, rooms, days, periods, fixed_assignments,
                 professors=None, holidays=None, timeslots=None, day_slots=None,
                 classrooms=None, students=None, population_size=50, generations=100,
                 mutation_rate=0.1, crossover_rate=0.8):
        # Store input parameters
        self.subjects = {s['shortName']: s for s in subjects}
        self.teachers = {t['name']: t for t in teachers}
        self.classes = {c['name']: c for c in classes}
        self.rooms = {r['name']: r for r in rooms}
        self.students = {s['id']: s for s in students} if students else {}

        self.days = days
        self.periods = periods
        self.fixed_assignments = fixed_assignments

        # GA parameters
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate

        # Create mappings
        self.teacher_map = {t['name']: i for i, t in enumerate(teachers)}
        self.room_map = {r['name']: i for i, r in enumerate(rooms)}
        self.day_map = {d: i for i, d in enumerate(days)}

        # Generate lecture requests
        self.requests = self._generate_requests()

        # Create initial population
        self.population = self._create_initial_population()

    def _generate_requests(self):
        """Generate lecture requests based on subject-class assignments"""
        requests = []
        fixed_hours = collections.defaultdict(int)

        # Process fixed assignments first
        for fa in self.fixed_assignments:
            key = (fa['class_id'], fa['subject_id'])
            fixed_hours[key] += 1
            requests.append({
                'class_id': fa['class_id'],
                'subject_id': fa['subject_id'],
                'duration': 1,
                'fixed_details': fa
            })

        # Process remaining subjects
        for s_id, s_details in self.subjects.items():
            target_classes = s_details.get('assignedClasses', [])
            if not target_classes:
                target_classes = list(self.classes.keys())

            for c_name in target_classes:
                if c_name not in self.classes:
                    continue

                remaining_hours = int(s_details.get('hours', 0)) - fixed_hours.get((c_name, s_id), 0)
                if remaining_hours <= 0:
                    continue

                # For lab subjects, create single request with duration equal to hours
                is_lab = s_details.get('isLab', False)
                if is_lab:
                    requests.append({
                        'class_id': c_name,
                        'subject_id': s_id,
                        'duration': remaining_hours,
                        'is_lab': True
                    })
                else:
                    # For regular subjects, create individual 1-hour requests
                    for i in range(remaining_hours):
                        requests.append({
                            'class_id': c_name,
                            'subject_id': s_id,
                            'duration': 1,
                            'instance': i
                        })
        return requests

    def _create_individual(self):
        """Create a single timetable individual"""
        timetable = []
        total_slots = len(self.days) * len(self.periods)

        for req in self.requests:
            # Handle fixed assignments
            if 'fixed_details' in req:
                fa = req['fixed_details']
                day_idx = self.day_map[fa['day']]
                period_idx = fa['period'] - 1
                slot = day_idx * len(self.periods) + period_idx
                teacher_idx = self.teacher_map[fa['teacher_name']]
                room_idx = self.room_map[fa['room_id']]

                timetable.append({
                    'slot': slot,
                    'teacher': teacher_idx,
                    'room': room_idx,
                    'request': req
                })
                continue

            # For non-fixed assignments, randomly assign
            # Find possible teachers
            possible_teachers = []
            for t_name, t_details in self.teachers.items():
                is_expert = req['subject_id'] in t_details.get('expertise', [])
                assigned_to_class = not t_details.get('assignedClasses') or req['class_id'] in t_details.get(
                    'assignedClasses', [])
                if is_expert and assigned_to_class:
                    possible_teachers.append(self.teacher_map[t_name])

            # Find possible rooms
            subject_details = self.subjects.get(req['subject_id'])
            is_lab = subject_details.get('isLab', False) or req.get('is_lab', False)
            required_room_type = 'lab' if is_lab else 'general'

            possible_rooms = []
            for r_name, r_details in self.rooms.items():
                is_correct_type = r_details.get('type') == required_room_type
                assigned_to_class = not r_details.get('assignedClasses') or req['class_id'] in r_details.get(
                    'assignedClasses', [])
                if is_correct_type and assigned_to_class:
                    possible_rooms.append(self.room_map[r_name])

            # Randomly select teacher and room
            if possible_teachers and possible_rooms:
                teacher = random.choice(possible_teachers)
                room = random.choice(possible_rooms)
                slot = random.randint(0, total_slots - req['duration'])

                timetable.append({
                    'slot': slot,
                    'teacher': teacher,
                    'room': room,
                    'request': req
                })
            else:
                # If no valid assignment, use placeholder values
                timetable.append({
                    'slot': 0,
                    'teacher': 0,
                    'room': 0,
                    'request': req
                })

        return timetable

    def _create_initial_population(self):
        """Create initial population of timetables"""
        population = []
        for _ in range(self.population_size):
            individual = self._create_individual()
            # Repair conflicts in initial population
            individual = self._repair_individual(individual)
            population.append(individual)
        return population

    def _repair_individual(self, individual):
        """Repair conflicts in an individual timetable"""
        total_slots = len(self.days) * len(self.periods)

        # Track all used slots for each resource
        class_slots = collections.defaultdict(set)
        teacher_slots = collections.defaultdict(set)
        room_slots = collections.defaultdict(set)

        # Separate fixed and variable assignments
        fixed_entries = [e for e in individual if 'fixed_details' in e['request']]
        variable_entries = [e for e in individual if 'fixed_details' not in e['request']]

        # First, lock in the slots for fixed assignments
        for entry in fixed_entries:
            for i in range(entry['request']['duration']):
                slot = entry['slot'] + i
                class_slots[entry['request']['class_id']].add(slot)
                teacher_slots[entry['teacher']].add(slot)
                room_slots[entry['room']].add(slot)

        # Now, try to place variable assignments in valid slots
        for entry in variable_entries:
            req = entry['request']
            duration = req['duration']
            class_id = req['class_id']

            # Find possible teachers and rooms
            possible_teachers = [self.teacher_map[t['name']] for t in self.teachers.values() if
                                 req['subject_id'] in t.get('expertise', []) and (
                                             not t.get('assignedClasses') or class_id in t.get('assignedClasses', []))]
            required_room_type = 'lab' if self.subjects.get(req['subject_id'], {}).get('isLab') else 'general'
            possible_rooms = [self.room_map[r['name']] for r in self.rooms.values() if
                              r.get('type') == required_room_type and (
                                          not r.get('assignedClasses') or class_id in r.get('assignedClasses', []))]

            if not possible_teachers or not possible_rooms:
                continue

                # Attempt to find a conflict-free slot
            for _ in range(200):  # More attempts to find a free slot
                new_slot = random.randint(0, total_slots - duration)
                new_teacher = random.choice(possible_teachers)
                new_room = random.choice(possible_rooms)

                # Check for conflict
                conflict = False
                for i in range(duration):
                    current_slot = new_slot + i
                    if (current_slot in class_slots[class_id] or
                            current_slot in teacher_slots[new_teacher] or
                            current_slot in room_slots[new_room]):
                        conflict = True
                        break

                if not conflict:
                    entry['slot'] = new_slot
                    entry['teacher'] = new_teacher
                    entry['room'] = new_room
                    break  # Move to the next entry once a valid slot is found

            # Add the entry to usage trackers, even if a conflict couldn't be resolved
            for i in range(entry['request']['duration']):
                slot = entry['slot'] + i
                class_slots[entry['request']['class_id']].add(slot)
                teacher_slots[entry['teacher']].add(slot)
                room_slots[entry['room']].add(slot)

        return individual

    def _slots_overlap(self, slot1, duration1, slot2, duration2):
        """Check if two time slots overlap"""
        start1, end1 = slot1, slot1 + duration1
        start2, end2 = slot2, slot2 + duration2
        return max(start1, start2) < min(end1, end2)

    def _calculate_fitness(self, timetable):
        """Calculate fitness score for a timetable"""
        penalty = 0

        class_slots = collections.defaultdict(list)
        teacher_slots = collections.defaultdict(list)
        room_slots = collections.defaultdict(list)

        for entry in timetable:
            req = entry['request']
            slot = entry['slot']
            duration = req['duration']
            teacher = entry['teacher']
            room = entry['room']
            class_id = req['class_id']

            entry_slots = list(range(slot, slot + duration))

            # HARD CONSTRAINTS (high penalty)
            # Check for overlaps by comparing the new set of slots with existing ones
            if any(s in class_slots[class_id] for s in entry_slots): penalty += 1000
            if any(s in teacher_slots[teacher] for s in entry_slots): penalty += 1000
            if any(s in room_slots[room] for s in entry_slots): penalty += 1000

            # Add slots to tracking dictionaries AFTER checking
            class_slots[class_id].extend(entry_slots)
            teacher_slots[teacher].extend(entry_slots)
            room_slots[room].extend(entry_slots)

            # Check if a lab session crosses a day boundary
            start_day = slot // len(self.periods)
            end_day = (slot + duration - 1) // len(self.periods)
            if start_day != end_day:
                penalty += 500

        # SOFT CONSTRAINTS (lower penalty)
        # Penalty for non-lab classes being scheduled consecutively for the same class
        for class_id, slots in class_slots.items():
            sorted_slots = sorted(slots)
            for i in range(len(sorted_slots) - 1):
                # Check for consecutive periods within the same day
                if sorted_slots[i + 1] - sorted_slots[i] == 1 and \
                        (sorted_slots[i] // len(self.periods)) == (sorted_slots[i + 1] // len(self.periods)):
                    # Find the subjects for these slots to ensure they are not part of the same lab
                    subject1 = next((e['request']['subject_id'] for e in timetable if e['slot'] == sorted_slots[i]),
                                    None)
                    subject2 = next((e['request']['subject_id'] for e in timetable if e['slot'] == sorted_slots[i + 1]),
                                    None)
                    is_lab1 = self.subjects.get(subject1, {}).get('isLab', False)
                    is_lab2 = self.subjects.get(subject2, {}).get('isLab', False)

                    if not is_lab1 and not is_lab2:
                        penalty += 10

        return max(0, 50000 - penalty)

    def _selection(self):
        """Tournament selection"""
        tournament_size = 5
        selected = []

        for _ in range(self.population_size):
            tournament = random.sample(self.population, min(tournament_size, len(self.population)))
            winner = max(tournament, key=self._calculate_fitness)
            selected.append(copy.deepcopy(winner))

        return selected

    def _crossover(self, parent1, parent2):
        """Single-point crossover"""
        if random.random() > self.crossover_rate:
            return copy.deepcopy(parent1), copy.deepcopy(parent2)

        # Create children as copies of parents
        child1 = copy.deepcopy(parent1)
        child2 = copy.deepcopy(parent2)

        # Perform crossover at a random point
        if len(parent1) > 1:
            crossover_point = random.randint(1, len(parent1) - 1)
            child1[:crossover_point] = parent2[:crossover_point]
            child2[:crossover_point] = parent1[:crossover_point]

        # Repair conflicts after crossover
        child1 = self._repair_individual(child1)
        child2 = self._repair_individual(child2)

        return child1, child2

    def _mutation(self, individual):
        """Random mutation of timetable entries"""
        for entry in individual:
            # Skip fixed assignments
            if 'fixed_details' in entry['request']:
                continue

            # Mutate with probability
            if random.random() < self.mutation_rate:
                # Randomly change slot, teacher, or room
                mutation_type = random.choice(['slot', 'teacher', 'room'])

                if mutation_type == 'slot':
                    total_slots = len(self.days) * len(self.periods)
                    entry['slot'] = random.randint(0, total_slots - entry['request']['duration'])
                elif mutation_type == 'teacher':
                    # Find possible teachers
                    req = entry['request']
                    possible_teachers = []
                    for t_name, t_details in self.teachers.items():
                        is_expert = req['subject_id'] in t_details.get('expertise', [])
                        assigned_to_class = not t_details.get('assignedClasses') or req['class_id'] in t_details.get(
                            'assignedClasses', [])
                        if is_expert and assigned_to_class:
                            possible_teachers.append(self.teacher_map[t_name])

                    if possible_teachers:
                        entry['teacher'] = random.choice(possible_teachers)
                elif mutation_type == 'room':
                    # Find possible rooms
                    req = entry['request']
                    subject_details = self.subjects.get(req['subject_id'])
                    is_lab = subject_details.get('isLab', False) or req.get('is_lab', False)
                    required_room_type = 'lab' if is_lab else 'general'

                    possible_rooms = []
                    for r_name, r_details in self.rooms.items():
                        is_correct_type = r_details.get('type') == required_room_type
                        assigned_to_class = not r_details.get('assignedClasses') or req['class_id'] in r_details.get(
                            'assignedClasses', [])
                        if is_correct_type and assigned_to_class:
                            possible_rooms.append(self.room_map[r_name])

                    if possible_rooms:
                        entry['room'] = random.choice(possible_rooms)

        # Repair conflicts after mutation
        individual = self._repair_individual(individual)
        return individual

    def evolve(self):
        """Main evolution loop"""
        best_fitness = 0
        best_individual = None

        for generation in range(self.generations):
            # Calculate fitness for all individuals
            fitness_scores = [
                (individual, self._calculate_fitness(individual))
                for individual in self.population
            ]

            # Track best solution
            current_best = max(fitness_scores, key=lambda x: x[1])
            if current_best[1] > best_fitness:
                best_fitness = current_best[1]
                best_individual = copy.deepcopy(current_best[0])

            # Selection
            self.population = self._selection()

            # Crossover and mutation
            new_population = []
            for i in range(0, len(self.population), 2):
                parent1 = self.population[i]
                parent2 = self.population[i + 1] if i + 1 < len(self.population) else self.population[0]

                child1, child2 = self._crossover(parent1, parent2)
                child1 = self._mutation(child1)
                child2 = self._mutation(child2)

                new_population.extend([child1, child2])

            self.population = new_population[:self.population_size]

            # Print progress
            if generation % 10 == 0:
                avg_fitness = sum(score for _, score in fitness_scores) / len(fitness_scores)
                print(f"Generation {generation}: Best={best_fitness}, Avg={avg_fitness}")

        return best_individual, best_fitness

    def get_solution(self, timetable):
        """Convert timetable to solution format"""
        solution = []
        total_slots = len(self.days) * len(self.periods)

        # Create reverse mappings
        teacher_map_rev = {i: list(self.teachers.values())[i] for i in range(len(self.teachers))}
        room_map_rev = {i: list(self.rooms.values())[i] for i in range(len(self.rooms))}

        for entry in timetable:
            req = entry['request']
            slot = entry['slot']
            teacher_idx = entry['teacher']
            room_idx = entry['room']

            # Convert indices back to names
            teacher_name = teacher_map_rev[teacher_idx]['name']
            room_name = room_map_rev[room_idx]['name']
            subject_name = self.subjects[req['subject_id']]['fullName']

            # For multi-period entries (labs), create separate entries
            duration = req['duration']
            is_lab = req.get('is_lab', False)

            for i in range(duration):
                current_slot = slot + i
                if current_slot >= total_slots:
                    break

                day_idx = current_slot // len(self.periods)
                period_idx = (current_slot % len(self.periods)) + 1  # 1-based
                day_name = self.days[day_idx]

                solution.append({
                    'class_id': req['class_id'],
                    'subject_id': req['subject_id'],
                    'subject_name': subject_name,
                    'teacher_name': teacher_name,
                    'room_id': room_name,
                    'day': day_name,
                    'period': period_idx,
                    'is_fixed': 'fixed_details' in req,
                    'is_lab': is_lab,
                    'lab_session_id': id(req) if is_lab else None
                })

        return solution


# --- TIMETABLE GENERATION LOGIC ---
def generate_feasible_solution_with_ga(subjects_list, teachers_list, classes_list, rooms_list, days, periods,
                                       fixed_assignments, professors_list=None, holidays_list=None,
                                       timeslots_list=None, day_slots_list=None, classrooms_list=None,
                                       students_list=None):
    try:
        # Create GA instance
        ga = TimetableGA(
            subjects=subjects_list,
            teachers=teachers_list,
            classes=classes_list,
            rooms=rooms_list,
            days=days,
            periods=periods,
            fixed_assignments=fixed_assignments,
            professors=professors_list,
            holidays=holidays_list,
            timeslots=timeslots_list,
            day_slots=day_slots_list,
            classrooms=classrooms_list,
            students=students_list,
            population_size=30,
            generations=50,
            mutation_rate=0.1,
            crossover_rate=0.8
        )

        # Run evolution
        best_timetable, best_fitness = ga.evolve()

        if best_timetable and best_fitness > 0:
            # Convert to solution format
            solution = ga.get_solution(best_timetable)
            return solution
        else:
            return None
    except Exception as e:
        print(f"GA Error: {e}")
        traceback.print_exc()
        return None


# --- FLASK ENDPOINT ---
@app.route('/generate', methods=['POST'])
def generate_timetable_endpoint():
    try:
        data = request.get_json()
        subjects = data.get('subjects', [])
        teachers = data.get('teachers', [])
        classes = data.get('classes', [])
        rooms = data.get('rooms', [])
        fixed_assignments = data.get('fixedAssignments', [])

        # New data structures
        professors = data.get('professors', [])
        holidays = data.get('holidays', [])
        timeslots = data.get('timeslots', [])
        day_slots = data.get('daySlots', [])
        classrooms = data.get('classrooms', [])
        students = data.get('students', [])

        # Use custom days/periods if provided, otherwise default
        days = [d['name'] for d in day_slots] if day_slots else ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        periods = list(range(1, len(timeslots) + 1)) if timeslots else [1, 2, 3, 4, 5, 6, 7]

        # Try GA approach first
        solution = generate_feasible_solution_with_ga(
            subjects, teachers, classes, rooms, days, periods, fixed_assignments,
            professors, holidays, timeslots, day_slots, classrooms, students
        )

        # If GA fails, fallback to CP-SAT
        if not solution:
            print("GA failed, falling back to CP-SAT...")
            solution = generate_feasible_solution_with_cp(
                subjects, teachers, classes, rooms, days, periods, fixed_assignments,
                professors, holidays, timeslots, day_slots, classrooms, students
            )

        if not solution:
            return jsonify({
                "error": "Could not find a solution. The problem is likely infeasible. Check for conflicting fixed assignments or insufficient resources (teachers/rooms)."}), 400

        # Store the generated timetable for later retrieval
        GENERATED_TIMETABLES['entries'] = solution
        GENERATED_TIMETABLES['metadata'] = {
            'generated_at': str(datetime.datetime.now()),
            'total_entries': len(solution),
            'days': days,
            'periods': periods
        }

        solution.sort(key=lambda x: (days.index(x['day']), x['period'], x['class_id']))
        return jsonify(solution)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"An internal error occurred: {e}"}), 500


def generate_feasible_solution_with_cp(subjects_list, teachers_list, classes_list, rooms_list, days, periods,
                                       fixed_assignments, professors_list=None, holidays_list=None,
                                       timeslots_list=None, day_slots_list=None, classrooms_list=None,
                                       students_list=None):
    # --- 1. Pre-process and Index Data ---
    subjects = {s['shortName']: s for s in subjects_list}
    teachers = {t['name']: t for t in teachers_list}
    classes = {c['name']: c for c in classes_list}
    rooms = {r['name']: r for r in rooms_list}
    students = {s['id']: s for s in students_list} if students_list else {}

    teacher_map_rev = {i: t for i, t in enumerate(teachers_list)}
    room_map_rev = {i: r for i, r in enumerate(rooms_list)}

    teacher_map = {t['name']: i for i, t in enumerate(teachers_list)}
    room_map = {r['name']: i for i, r in enumerate(rooms_list)}
    day_map = {d: i for i, d in enumerate(days)}

    # --- 2. Generate Lecture Requests based on Subject-Class assignments ---
    requests = []
    fixed_hours = collections.defaultdict(int)

    # Process fixed assignments first
    for fa in fixed_assignments:
        key = (fa['class_id'], fa['subject_id'])
        fixed_hours[key] += 1
        requests.append({
            'class_id': fa['class_id'],
            'subject_id': fa['subject_id'],
            'duration': 1,
            'fixed_details': fa
        })

    # Process remaining subjects
    for s_id, s_details in subjects.items():
        target_classes = s_details.get('assignedClasses', [])
        if not target_classes:
            target_classes = list(classes.keys())

        for c_name in target_classes:
            if c_name not in classes:
                continue

            remaining_hours = int(s_details.get('hours', 0)) - fixed_hours.get((c_name, s_id), 0)
            if remaining_hours <= 0:
                continue

            # For lab subjects, create single request with duration equal to hours
            is_lab = s_details.get('isLab', False)
            if is_lab:
                requests.append({
                    'class_id': c_name,
                    'subject_id': s_id,
                    'duration': remaining_hours,
                    'is_lab': True
                })
            else:
                # For regular subjects, create individual 1-hour requests
                for i in range(remaining_hours):
                    requests.append({
                        'class_id': c_name,
                        'subject_id': s_id,
                        'duration': 1,
                        'instance': i
                    })

    # --- 3. Create Model and Variables ---
    model = cp_model.CpModel()
    num_periods_per_day = len(periods)
    total_slots = len(days) * num_periods_per_day
    task_vars = {}

    for i, req in enumerate(requests):
        start_var = model.NewIntVar(0, total_slots - req['duration'], f"start_{i}")
        interval_var = model.NewIntervalVar(start_var, req['duration'], start_var + req['duration'], f"interval_{i}")

        # Find possible teachers
        possible_teachers = []
        for t_name, t_details in teachers.items():
            is_expert = req['subject_id'] in t_details.get('expertise', [])
            assigned_to_class = not t_details.get('assignedClasses') or req['class_id'] in t_details.get(
                'assignedClasses', [])
            if is_expert and assigned_to_class:
                possible_teachers.append(teacher_map[t_name])

        if not possible_teachers:
            print(f"Error: No suitable teachers found for Subject '{req['subject_id']}' in Class '{req['class_id']}'.")
            return None

        # Find possible rooms
        subject_details = subjects.get(req['subject_id'])
        is_lab = subject_details.get('isLab', False) or req.get('is_lab', False)
        required_room_type = 'lab' if is_lab else 'general'

        possible_rooms = []
        for r_name, r_details in rooms.items():
            is_correct_type = r_details.get('type') == required_room_type
            assigned_to_class = not r_details.get('assignedClasses') or req['class_id'] in r_details.get(
                'assignedClasses', [])
            if is_correct_type and assigned_to_class:
                possible_rooms.append(room_map[r_name])

        if not possible_rooms:
            print(f"Error: No suitable rooms found for Subject '{req['subject_id']}' in Class '{req['class_id']}'.")
            return None

        teacher_var = model.NewIntVarFromDomain(cp_model.Domain.FromValues(possible_teachers), f"teacher_{i}")
        room_var = model.NewIntVarFromDomain(cp_model.Domain.FromValues(possible_rooms), f"room_{i}")

        task_vars[i] = {
            'start': start_var,
            'interval': interval_var,
            'teacher': teacher_var,
            'room': room_var,
            'request': req,
            'possible_teachers': possible_teachers,
            'possible_rooms': possible_rooms
        }

    # --- 4. Define Constraints ---

    # Fixed assignments constraint
    for i, task in task_vars.items():
        if 'fixed_details' in task['request']:
            fa = task['request']['fixed_details']
            try:
                period_index = fa['period'] - 1
                day_index = day_map[fa['day']]
                model.Add(task['start'] == day_index * num_periods_per_day + period_index)
                model.Add(task['teacher'] == teacher_map[fa['teacher_name']])
                model.Add(task['room'] == room_map[fa['room_id']])
            except KeyError as e:
                print(f"Warning: A fixed assignment contains an invalid value: {e}.")

    # No overlap for classes
    for c_name in classes:
        model.AddNoOverlap([task['interval'] for task in task_vars.values() if task['request']['class_id'] == c_name])

    # No overlap for teachers and rooms
    teacher_intervals = collections.defaultdict(list)
    room_intervals = collections.defaultdict(list)

    for i, task in task_vars.items():
        for teacher_idx in task['possible_teachers']:
            is_present = model.NewBoolVar(f"present_{i}_t{teacher_idx}")
            model.Add(task['teacher'] == teacher_idx).OnlyEnforceIf(is_present)
            model.Add(task['teacher'] != teacher_idx).OnlyEnforceIf(is_present.Not())
            optional_interval = model.NewOptionalIntervalVar(
                task['start'], task['request']['duration'], task['start'] + task['request']['duration'],
                is_present, f"optional_interval_{i}_t{teacher_idx}"
            )
            teacher_intervals[teacher_idx].append(optional_interval)

        for room_idx in task['possible_rooms']:
            is_present = model.NewBoolVar(f"present_{i}_r{room_idx}")
            model.Add(task['room'] == room_idx).OnlyEnforceIf(is_present)
            model.Add(task['room'] != room_idx).OnlyEnforceIf(is_present.Not())
            optional_interval = model.NewOptionalIntervalVar(
                task['start'], task['request']['duration'], task['start'] + task['request']['duration'],
                is_present, f"optional_interval_{i}_r{room_idx}"
            )
            room_intervals[room_idx].append(optional_interval)

    for intervals in teacher_intervals.values():
        model.AddNoOverlap(intervals)
    for intervals in room_intervals.values():
        model.AddNoOverlap(intervals)

    # --- 5. Additional Constraints for Better Timetable ---

    # Constraint: Lab subjects should be scheduled together (already handled by duration)

    # Constraint: No continuous periods except for labs
    for i, task in task_vars.items():
        req = task['request']
        if not req.get('is_lab', False) and 'fixed_details' not in req:  # Non-lab tasks
            for day_idx in range(len(days)):
                for period_idx in range(num_periods_per_day - 1):  # Check consecutive periods
                    slot1 = day_idx * num_periods_per_day + period_idx
                    slot2 = day_idx * num_periods_per_day + period_idx + 1

                    # Create boolean variables for being in each slot
                    in_slot1 = model.NewBoolVar(f"in_slot1_{i}_{day_idx}_{period_idx}")
                    in_slot2 = model.NewBoolVar(f"in_slot2_{i}_{day_idx}_{period_idx}")

                    model.Add(task['start'] <= slot1).OnlyEnforceIf(in_slot1)
                    model.Add(task['start'] + req['duration'] > slot1).OnlyEnforceIf(in_slot1)

                    model.Add(task['start'] <= slot2).OnlyEnforceIf(in_slot2)
                    model.Add(task['start'] + req['duration'] > slot2).OnlyEnforceIf(in_slot2)

                    # Prevent both consecutive periods from being used by same class
                    model.AddBoolOr([in_slot1.Not(), in_slot2.Not()])

    # --- 6. Solve and Extract Solution ---
    print("Starting CP-SAT solver...")
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60.0
    status = solver.Solve(model)
    print(f"Solver finished with status: {solver.StatusName(status)}")

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        solution = []
        for i, task in task_vars.items():
            start_val = solver.Value(task['start'])
            teacher_idx = solver.Value(task['teacher'])
            room_idx = solver.Value(task['room'])
            req = task['request']

            # For lab subjects with duration > 1, create multiple entries
            duration = req['duration']
            is_lab = req.get('is_lab', False)

            for j in range(duration):
                day = days[(start_val + j) // num_periods_per_day]
                period = ((start_val + j) % num_periods_per_day) + 1  # 1-based indexing
                solution.append({
                    'class_id': req['class_id'],
                    'subject_id': req['subject_id'],
                    'subject_name': subjects[req['subject_id']]['fullName'],
                    'teacher_name': teacher_map_rev[teacher_idx]['name'],
                    'room_id': room_map_rev[room_idx]['name'],
                    'day': day,
                    'period': period,
                    'is_fixed': 'fixed_details' in req,
                    'is_lab': is_lab,
                    'lab_session_id': i if is_lab else None
                })

        return solution
    else:
        return None

